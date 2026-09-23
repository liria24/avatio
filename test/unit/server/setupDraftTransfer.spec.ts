import { createDefaultSetupComposeForm, type SetupDraftContent } from '@avatio/core/setups'
import { createError, type H3Event } from '@nuxt/nitro-server/h3'
import { drizzle } from 'drizzle-orm/d1'
import type { ZodType } from 'zod'

import { relations } from '../../../database/relations'
import type { AppDatabase } from '../../../server/utils/database'
import { executeAppBatch } from '../../../server/utils/executeAppBatch'
import { createTestD1 } from '../../helpers/d1'

const draftId = '00000000-0000-4000-8000-000000000001'
const sourceUserId = 'source-user'
const targetUserId = 'target-user'
const sourceUrl = 'https://files.example.com/setup/source-user/image.jpg'
const sourceKey = 'setup/source-user/image.jpg'
const validBody = { targetSessionToken: 'target-token', expectedRevision: 1 }
let requestBody = validBody
const content = {
    ...createDefaultSetupComposeForm(),
    name: 'Transferred draft',
    images: [sourceUrl],
    imageMetadata: {
        [sourceUrl]: {
            id: 'image-id',
            objectKey: sourceKey,
            contentType: 'image/jpeg',
            width: 640,
            height: 480,
        },
    },
    items: [
        {
            id: 'entry-1',
            itemId: 'item-1',
            category: 'avatar' as const,
            note: '',
            unsupported: false,
            shapekeys: [],
        },
        {
            id: 'entry-2',
            itemId: 'item-2',
            category: 'accessory' as const,
            note: '',
            unsupported: false,
            shapekeys: [],
        },
    ],
}

const insertUser = (sqlite: ReturnType<typeof createTestD1>['sqlite'], id: string) =>
    sqlite
        .prepare(
            'INSERT INTO users (id, name, username, display_username, email) VALUES (?, ?, ?, ?, ?)',
        )
        .run(id, id, id, id, `${id}@example.com`)

describe('setup draft transfer', () => {
    const appendResponseHeader = vi.fn()
    const setActiveSession = vi.fn()
    const copy = vi.fn()
    const url = vi.fn(async (key: string) => `https://files.example.com/${key}`)

    afterEach(() => {
        requestBody = validBody
        vi.resetModules()
        vi.unstubAllGlobals()
    })

    const setup = async () => {
        const database = createTestD1()
        const db = drizzle(database.binding, { relations })
        insertUser(database.sqlite, sourceUserId)
        insertUser(database.sqlite, targetUserId)
        database.sqlite
            .prepare(
                'INSERT INTO setup_drafts (id, user_id, revision, content) VALUES (?, ?, 1, ?)',
            )
            .run(draftId, sourceUserId, JSON.stringify(content))
        database.sqlite
            .prepare(
                'INSERT INTO setup_draft_images (id, setup_draft_id, object_key) VALUES (?, ?, ?)',
            )
            .run('draft-image', draftId, sourceKey)

        appendResponseHeader.mockReset()
        setActiveSession.mockReset()
        copy.mockReset()
        url.mockClear()
        setActiveSession.mockResolvedValue({
            headers: new Headers({ 'set-cookie': 'better-auth.session_token=target' }),
            response: { user: { id: targetUserId, banned: false }, session: {} },
        })
        copy.mockResolvedValue(undefined)

        Object.entries({
            authedSessionEventHandler: (handler: unknown) => handler,
            validateParams: async (schema: ZodType) => schema.parse({ id: draftId }),
            validateBody: async (schema: ZodType) => schema.parse(requestBody),
            enforceRateLimit: vi.fn(),
            serverAuth: () => ({ api: { setActiveSession } }),
            useServerFiles: () => ({ copy, url }),
            isUserSetupImageKey: (key: string, userId: string) =>
                key.startsWith(`setup/${userId}/`),
            executeAppBatch,
            appendResponseHeader,
            createError,
        }).forEach(([key, value]) => vi.stubGlobal(key, value))

        const route = (await import('../../../server/api/setup-drafts/[id]/transfer.post'))
            .default as unknown as (context: {
            event: H3Event
            session: { user: { id: string } }
            db: AppDatabase
        }) => Promise<{ id: string; revision: number }>
        const event = { headers: new Headers({ cookie: 'signed-device-sessions' }) } as H3Event
        return { database, db, route, event }
    }

    it('moves an owned draft and its image before activating the target account', async () => {
        const { database, db, route, event } = await setup()
        try {
            await expect(
                route({ event, db, session: { user: { id: sourceUserId } } }),
            ).resolves.toEqual({ id: draftId, revision: 2 })

            const draft = database.sqlite
                .prepare('SELECT user_id, revision, content FROM setup_drafts WHERE id = ?')
                .get(draftId) as { user_id: string; revision: number; content: string }
            const movedContent = JSON.parse(draft.content) as SetupDraftContent
            const movedKey = movedContent.imageMetadata?.[movedContent.images[0]!]!.objectKey
            expect(draft).toMatchObject({ user_id: targetUserId, revision: 2 })
            expect(movedKey).toMatch(/^setup\/target-user\/.+\.jpg$/)
            expect(movedContent.items).toEqual(content.items)
            expect(copy).toHaveBeenCalledWith(sourceKey, movedKey)
            expect(
                database.sqlite
                    .prepare('SELECT object_key FROM setup_draft_images WHERE setup_draft_id = ?')
                    .all(draftId),
            ).toEqual([{ object_key: movedKey }])
            expect(appendResponseHeader).toHaveBeenCalledWith(
                event,
                'set-cookie',
                'better-auth.session_token=target',
            )
        } finally {
            database.sqlite.close()
        }
    })

    it('returns not found without validating a target when the active user is not the owner', async () => {
        const { database, db, route, event } = await setup()
        try {
            await expect(
                route({ event, db, session: { user: { id: 'attacker' } } }),
            ).rejects.toMatchObject({ statusCode: 404 })
            expect(setActiveSession).not.toHaveBeenCalled()
            expect(copy).not.toHaveBeenCalled()
            expect(appendResponseHeader).not.toHaveBeenCalled()
            expect(
                database.sqlite
                    .prepare('SELECT user_id, revision FROM setup_drafts WHERE id = ?')
                    .get(draftId),
            ).toEqual({ user_id: sourceUserId, revision: 1 })

            database.sqlite.prepare('DELETE FROM setup_drafts WHERE id = ?').run(draftId)
            await expect(
                route({ event, db, session: { user: { id: sourceUserId } } }),
            ).rejects.toMatchObject({ statusCode: 404 })
            expect(setActiveSession).not.toHaveBeenCalled()
        } finally {
            database.sqlite.close()
        }
    })

    it('requires the target token to be backed by the signed device-session cookie', async () => {
        const { database, db, route } = await setup()
        setActiveSession.mockImplementation(({ headers }: { headers: Headers }) =>
            headers.get('cookie') ? undefined : Promise.reject(createError({ statusCode: 401 })),
        )
        try {
            const event = { headers: new Headers() } as H3Event
            await expect(
                route({ event, db, session: { user: { id: sourceUserId } } }),
            ).rejects.toMatchObject({ statusCode: 401 })
            expect(setActiveSession).toHaveBeenCalledWith({
                headers: event.headers,
                body: { sessionToken: 'target-token' },
                returnHeaders: true,
            })
            expect(copy).not.toHaveBeenCalled()
            expect(appendResponseHeader).not.toHaveBeenCalled()
        } finally {
            database.sqlite.close()
        }
    })

    it.each([
        ['the same account', { id: sourceUserId, banned: false }, 400],
        ['a banned account', { id: targetUserId, banned: true }, 403],
    ])('rejects %s without changing the draft or cookies', async (_, user, statusCode) => {
        const { database, db, route, event } = await setup()
        setActiveSession.mockResolvedValue({
            headers: new Headers({ 'set-cookie': 'better-auth.session_token=target' }),
            response: { user, session: {} },
        })
        try {
            await expect(
                route({ event, db, session: { user: { id: sourceUserId } } }),
            ).rejects.toMatchObject({ statusCode })
            expect(
                database.sqlite
                    .prepare('SELECT user_id, revision FROM setup_drafts WHERE id = ?')
                    .get(draftId),
            ).toEqual({ user_id: sourceUserId, revision: 1 })
            expect(copy).not.toHaveBeenCalled()
            expect(appendResponseHeader).not.toHaveBeenCalled()
        } finally {
            database.sqlite.close()
        }
    })

    it('rejects stale revisions before target authentication', async () => {
        requestBody = { ...validBody, expectedRevision: 2 }
        const { database, db, route, event } = await setup()
        try {
            await expect(
                route({ event, db, session: { user: { id: sourceUserId } } }),
            ).rejects.toMatchObject({ statusCode: 409 })
            expect(setActiveSession).not.toHaveBeenCalled()
            expect(copy).not.toHaveBeenCalled()
            expect(appendResponseHeader).not.toHaveBeenCalled()
        } finally {
            database.sqlite.close()
        }
    })

    it('rejects drafts for existing setups', async () => {
        const { database, db, route, event } = await setup()
        database.sqlite
            .prepare('INSERT INTO setups (id, user_id, name) VALUES (?, ?, ?)')
            .run('existing-setup', sourceUserId, 'Existing setup')
        database.sqlite
            .prepare('UPDATE setup_drafts SET setup_id = ? WHERE id = ?')
            .run('existing-setup', draftId)
        try {
            await expect(
                route({ event, db, session: { user: { id: sourceUserId } } }),
            ).rejects.toMatchObject({ statusCode: 400 })
            expect(setActiveSession).not.toHaveBeenCalled()
            expect(copy).not.toHaveBeenCalled()
            expect(appendResponseHeader).not.toHaveBeenCalled()
        } finally {
            database.sqlite.close()
        }
    })

    it('rejects a target account at the draft limit', async () => {
        const { database, db, route, event } = await setup()
        const insert = database.sqlite.prepare(
            'INSERT INTO setup_drafts (id, user_id, revision, content) VALUES (?, ?, 1, ?)',
        )
        for (let index = 0; index < 32; index++)
            insert.run(crypto.randomUUID(), targetUserId, JSON.stringify(content))
        try {
            await expect(
                route({ event, db, session: { user: { id: sourceUserId } } }),
            ).rejects.toMatchObject({ statusCode: 400 })
            expect(copy).not.toHaveBeenCalled()
            expect(appendResponseHeader).not.toHaveBeenCalled()
        } finally {
            database.sqlite.close()
        }
    })

    it('does not move the draft or change cookies when target authentication fails', async () => {
        const { database, db, route, event } = await setup()
        setActiveSession.mockRejectedValue(new Error('Invalid target session'))
        try {
            await expect(
                route({ event, db, session: { user: { id: sourceUserId } } }),
            ).rejects.toThrow('Invalid target session')
            expect(
                database.sqlite
                    .prepare('SELECT user_id, revision FROM setup_drafts WHERE id = ?')
                    .get(draftId),
            ).toEqual({ user_id: sourceUserId, revision: 1 })
            expect(copy).not.toHaveBeenCalled()
            expect(appendResponseHeader).not.toHaveBeenCalled()
        } finally {
            database.sqlite.close()
        }
    })

    it('keeps the source draft when copying its image fails', async () => {
        const { database, db, route, event } = await setup()
        copy.mockRejectedValue(new Error('copy failed'))
        try {
            await expect(
                route({ event, db, session: { user: { id: sourceUserId } } }),
            ).rejects.toThrow('copy failed')
            expect(
                database.sqlite
                    .prepare('SELECT user_id, revision FROM setup_drafts WHERE id = ?')
                    .get(draftId),
            ).toEqual({ user_id: sourceUserId, revision: 1 })
            expect(appendResponseHeader).not.toHaveBeenCalled()
        } finally {
            database.sqlite.close()
        }
    })

    it('keeps the source owner and active session when the conditional update loses a race', async () => {
        const { database, db, route, event } = await setup()
        copy.mockImplementation(async () => {
            database.sqlite
                .prepare('UPDATE setup_drafts SET revision = 2 WHERE id = ?')
                .run(draftId)
        })
        try {
            await expect(
                route({ event, db, session: { user: { id: sourceUserId } } }),
            ).rejects.toMatchObject({ statusCode: 409 })
            expect(
                database.sqlite
                    .prepare('SELECT user_id, revision FROM setup_drafts WHERE id = ?')
                    .get(draftId),
            ).toEqual({ user_id: sourceUserId, revision: 2 })
            expect(appendResponseHeader).not.toHaveBeenCalled()
        } finally {
            database.sqlite.close()
        }
    })
})
