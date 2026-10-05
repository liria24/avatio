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

describe('PR Preview runtime boundaries', () => {
    const url = 'https://pr-354.previews.example.test'
    const authOptions = () =>
        createAvatioAuthOptions({
            runtimeConfig: { public: { siteUrl: url, emailPasswordAuthEnabled: true } },
        } as Parameters<typeof createAvatioAuthOptions>[0])

    it('registers and signs in a normal user in migrated PR D1, without installing the local admin trigger', async () => {
        const database = createTestD1()
        vi.stubGlobal('__env__', {
            APP_DB: database.binding,
            STAGE: 'development',
            PREVIEW_NAME: 'pr-354',
            AUTH_TRUSTED_ORIGINS: JSON.stringify([url]),
        })
        const options = authOptions()
        const auth = betterAuth({
            ...options,
            baseURL: url,
            secret: 'preview-test-secret-with-more-than-32-characters',
        })
        try {
            expect(options.emailAndPassword.enabled).toBe(true)
            expect(options.socialProviders).toEqual({})
            expect(
                options.trustedOrigins(
                    new Request(
                        'https://unrelated-avatio.account.workers.dev/api/auth/get-session',
                    ),
                ),
            ).toEqual([url])
            const credentials = { email: 'preview@example.test', password: 'test-password-12345' }
            const registered = await auth.api.signUpEmail({
                body: { ...credentials, name: 'Preview User', username: 'preview_user' },
            })
            const signedIn = await auth.api.signInEmail({ body: credentials, returnHeaders: true })
            expect(signedIn.response.user.id).toBe(registered.user.id)
            expect(database.sqlite.prepare('SELECT role FROM users').get()).toMatchObject({
                role: 'user',
            })
            expect(
                database.sqlite
                    .prepare("SELECT name FROM sqlite_schema WHERE type = 'trigger'")
                    .all(),
            ).toEqual([])
            const session = await auth.api.getSession({
                headers: new Headers({
                    cookie: signedIn.headers
                        .getSetCookie()
                        .map((cookie) => cookie.split(';')[0])
                        .join('; '),
                }),
            })
            expect(session?.user.id).toBe(registered.user.id)
        } finally {
            database.sqlite.close()
        }
    })

    it.each(['production', 'development'])(
        'rejects email registration in %s despite the public UI flag',
        async (stage) => {
            const database = createTestD1()
            vi.stubGlobal('__env__', { APP_DB: database.binding, STAGE: stage })
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

    it.each(['development', 'pr-354'])(
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
