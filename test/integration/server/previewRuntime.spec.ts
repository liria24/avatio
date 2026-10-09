import { betterAuth } from 'better-auth/minimal'
import { drizzle } from 'drizzle-orm/d1'

import { relations } from '../../../database/relations'
import { createAvatioAuthOptions } from '../../../server/auth.config'
import { getCatalogSyncQueue } from '../../../server/utils/catalogRuntime'
import { createTestD1 } from '../../helpers/d1'

const { syncSource } = vi.hoisted(() => ({ syncSource: vi.fn() }))
vi.mock('@nuxtjs/better-auth/config', () => ({ defineServerAuth: (value: unknown) => value }))
vi.mock('@avatio/core/catalog', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@avatio/core/catalog')>()),
    syncCatalogSource: syncSource,
}))

afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
})

describe('development Preview runtime boundaries', () => {
    const url = 'https://development.previews.example.test'
    const authOptions = () =>
        createAvatioAuthOptions({
            runtimeConfig: { public: { siteUrl: url, emailPasswordAuthEnabled: true } },
        } as Parameters<typeof createAvatioAuthOptions>[0])

    it('keeps Twitter OAuth and exact configured origins in the persistent development Preview', () => {
        vi.stubGlobal('__env__', {
            STAGE: 'development',
            PREVIEW_NAME: 'development',
            AUTH_TRUSTED_ORIGINS: JSON.stringify([url]),
            TWITTER_CLIENT_ID: 'synthetic-client-id',
            TWITTER_CLIENT_SECRET: 'synthetic-client-secret',
        })
        const options = authOptions()
        expect(options.emailAndPassword.enabled).toBe(false)
        expect(options.socialProviders).toMatchObject({
            twitter: { clientId: 'synthetic-client-id', clientSecret: 'synthetic-client-secret' },
        })
        expect(
            options.trustedOrigins(
                new Request('https://unrelated.example.test/api/auth/get-session'),
            ),
        ).toEqual([url])
    })

    it.each([
        ['production', undefined],
        ['development', undefined],
        ['development', 'development'],
    ])(
        'rejects email registration in %s / %s despite the public UI flag',
        async (stage, previewName) => {
            const database = createTestD1()
            vi.stubGlobal('__env__', {
                APP_DB: database.binding,
                STAGE: stage,
                PREVIEW_NAME: previewName,
            })
            const options = authOptions()
            const auth = betterAuth({
                ...options,
                baseURL: url,
                secret: 'preview-test-secret-with-more-than-32-characters',
            })
            try {
                expect(options.emailAndPassword.enabled).toBe(false)
                await expect(
                    auth.api.signUpEmail({
                        body: {
                            email: 'user@example.test',
                            password: 'test-password-12345',
                            name: 'User',
                            username: 'blocked_user',
                        },
                    }),
                ).rejects.toThrow()
                expect(
                    database.sqlite.prepare('SELECT count(*) AS count FROM users').get(),
                ).toMatchObject({ count: 0 })
            } finally {
                database.sqlite.close()
            }
        },
    )

    it.each(['development'])(
        'awaits fenced inline Catalog sync in %s instead of sending Queue messages',
        async (name) => {
            const database = createTestD1()
            const send = vi.fn()
            vi.stubGlobal('__env__', {
                STAGE: 'development',
                PREVIEW_NAME: name,
                ITEM_REVALIDATION_QUEUE: { send },
            })
            vi.stubGlobal('useDB', () => drizzle(database.binding, { relations }))
            vi.stubGlobal('getPublisherRepository', () => ({ upsertSource: vi.fn() }))
            vi.stubGlobal('BOOTH_CATEGORY_MAP', {})
            vi.stubGlobal('providerHttpClient', {})
            let finish: (() => void) | undefined
            syncSource.mockImplementation(
                () =>
                    new Promise<void>((resolve) => {
                        finish = resolve
                    }),
            )
            try {
                const queue = getCatalogSyncQueue()!
                const message = {
                    version: 2 as const,
                    type: 'catalog.sync-source' as const,
                    sourceId: 'source-id',
                    leaseToken: 'claimed-lease',
                }
                let completed = false
                const pending = queue.enqueue(message).then(() => {
                    completed = true
                })
                await vi.waitFor(() => expect(syncSource).toHaveBeenCalled())
                expect(syncSource).toHaveBeenCalledWith(
                    expect.objectContaining({
                        sourceId: message.sourceId,
                        leaseToken: message.leaseToken,
                    }),
                )
                expect(completed).toBe(false)
                expect(send).not.toHaveBeenCalled()
                finish!()
                await pending
                expect(completed).toBe(true)
                syncSource.mockRejectedValueOnce(new Error('sync failed'))
                await expect(queue.enqueue(message)).rejects.toThrow('sync failed')
            } finally {
                database.sqlite.close()
            }
        },
    )
})
