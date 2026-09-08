import { drizzle } from 'drizzle-orm/d1'
import type { H3Event } from 'h3'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { relations } from '../../../database/relations'
import { users } from '../../../database/schema'
import createNotification from '../../../server/utils/createNotification'
import type { AppDatabase } from '../../../server/utils/database'
import { executeD1Batch } from '../../../server/utils/executeD1Batch'
import { createSetup } from '../../../server/utils/setupCommands'
import { userSettingsDefaults } from '../../../shared/utils/userSettingsDefaults'
import { createTestD1 } from '../../helpers/d1'

let database: ReturnType<typeof createTestD1>
let db: AppDatabase
const background: Promise<unknown>[] = []
beforeEach(() => {
    database = createTestD1()
    db = drizzle(database.binding, { relations })
    background.length = 0
    Object.entries({
        logger: () => ({ error: vi.fn() }),
        createNotification,
        userSettingsDefaults,
        authedSessionEventHandler: (handler: unknown) => handler,
        sessionEventHandler: (handler: unknown) => handler,
        validateParams: async () => ({ username: 'author' }),
        validateQuery: async () => ({ page: 1, limit: 20 }),
        enforceRateLimit: vi.fn(),
        invalidateUserContentCache: vi.fn(),
        applyNoStoreCache: vi.fn(),
        runAfterResponse: (promise: Promise<unknown>) => background.push(promise),
        createError: (input: { status: number }) =>
            Object.assign(new Error('Request failed'), input),
    }).forEach(([name, value]) => vi.stubGlobal(name, value))
    database.sqlite.exec(`
        INSERT INTO users (id, name, username, display_username, email) VALUES
            ('author', 'Author', 'author', 'Author', 'author@example.com'),
            ('viewer', 'Viewer', 'viewer', 'Viewer', 'viewer@example.com');
    `)
})
afterEach(async () => {
    await Promise.all(background)
    database.sqlite.close()
    vi.unstubAllGlobals()
})

it('follows idempotently, enforces private follow lists, and respects muted notification actors', async () => {
    type Route = (input: {
        db: AppDatabase
        event: H3Event
        session: { user: { id: string; username: string; name: string } } | null
    }) => Promise<unknown>
    const follow = (await import('../../../server/api/users/[username]/follow/index.post'))
        .default as unknown as Route
    const input = {
        db,
        event: {} as H3Event,
        session: { user: { id: 'viewer', username: 'viewer', name: 'Viewer' } },
    }
    await follow(input)
    await follow(input)
    await Promise.all(background)
    expect(database.sqlite.prepare('SELECT * FROM user_follows').all()).toHaveLength(1)
    expect(database.sqlite.prepare('SELECT * FROM notifications').all()).toHaveLength(1)
    await expect(
        follow({
            ...input,
            session: { user: { id: 'author', username: 'author', name: 'Author' } },
        }),
    ).rejects.toMatchObject({ status: 400 })

    database.sqlite.exec(
        "INSERT INTO user_settings (user_id, public_followees, notif_site_followed) VALUES ('author', 0, 0)",
    )
    const followees = (await import('../../../server/api/users/[username]/followees.get'))
        .default as unknown as Route
    await expect(followees({ ...input, session: null })).rejects.toMatchObject({ status: 403 })
    await expect(
        followees({
            ...input,
            session: { user: { id: 'author', username: 'author', name: 'Author' } },
        }),
    ).resolves.toMatchObject({ followees: [] })
    const notification = {
        userId: 'author',
        type: 'user_followed' as const,
        actorId: 'viewer',
        payload: { user: { username: 'viewer', name: 'Viewer' } },
    }
    expect(await createNotification(db, notification)).toBeNull()
    database.sqlite.exec(
        "UPDATE user_settings SET notif_site_followed = 1; INSERT INTO user_mutes (id, user_id, mutee_id) VALUES ('mute', 'author', 'viewer')",
    )
    expect(await createNotification(db, notification)).toBeNull()
    database.sqlite.exec('DELETE FROM user_mutes')
    expect(await createNotification(db, notification)).toHaveProperty('id')
    expect(applyNoStoreCache).toHaveBeenCalled()
})

it('notifies followers only after a public Setup is committed', async () => {
    database.sqlite.exec(
        "INSERT INTO user_follows (user_id, followee_id) VALUES ('viewer', 'author')",
    )
    Object.entries({
        executeD1Batch,
        resolveSetupImageData: async () => [],
        completeIdempotencyRequest: () => db.select().from(users),
        invalidateCacheResources: vi.fn(),
        EDGE_CACHE_TAGS: { setups: 'setups', popularAvatars: 'popular-avatars' },
        querySetupProjection: async (_db: AppDatabase, id: string) => ({
            setup: {
                id,
                name: id,
                public: id === 'public',
                user: { username: 'author', name: 'Author' },
            },
        }),
    }).forEach(([name, value]) => vi.stubGlobal(name, value))
    for (const id of ['private', 'public']) {
        database.sqlite
            .prepare(
                'INSERT INTO idempotency_requests (id, scope, route, key, request_hash, lease_expires_at, expires_at) VALUES (?, ?, ?, ?, ?, 1, 2)',
            )
            .run(`request-${id}`, 'author', '/api/setups', id, id)
        await createSetup(
            { db, event: {} as H3Event, user: { id: 'author' } },
            { name: id, public: id === 'public', items: [] },
            id,
            {
                id: `request-${id}`,
                key: id,
                resourceId: id,
                replay: false,
                response: null,
                statusCode: null,
            },
        )
        await Promise.all(background)
    }
    const rows = database.sqlite.prepare('SELECT payload FROM notifications').all()
    expect(rows).toHaveLength(1)
    expect(JSON.parse(rows[0]!.payload as string)).toMatchObject({ setup: { id: 'public' } })
})
