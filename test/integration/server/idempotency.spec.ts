import { createError } from '@nuxt/nitro-server/h3'
import { drizzle } from 'drizzle-orm/d1'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { relations } from '../../../database/relations'
import { completeIdempotencyRequest } from '../../../server/utils/idempotency'
import { createTestD1 } from '../../helpers/d1'
let database: ReturnType<typeof createTestD1>
let db: ReturnType<typeof drizzle<typeof relations>>
beforeEach(() => {
    database = createTestD1()
    db = drizzle(database.binding, { relations })
})
afterEach(() => {
    database.sqlite.close()
    vi.unstubAllGlobals()
})

const key = '4ecb4ccc-216c-4a66-b538-0a83f55fb9cc'

const makeEvent = (idempotencyKey?: string) => {
    const setHeader = vi.fn()
    return {
        event: {
            node: {
                req: { headers: { 'idempotency-key': idempotencyKey } },
                res: { setHeader },
            },
        },
        setHeader,
    }
}

describe('idempotency request claims', () => {
    beforeEach(() => {
        vi.stubGlobal('createError', createError)
        vi.stubGlobal(
            'getHeader',
            (event: ReturnType<typeof makeEvent>['event']) =>
                event.node.req.headers['idempotency-key'],
        )
        vi.stubGlobal(
            'setResponseHeader',
            (event: ReturnType<typeof makeEvent>['event'], name: string, value: string | number) =>
                event.node.res.setHeader(name, value),
        )
    })

    it('separates scopes and routes and reclaims only an expired pending request', async () => {
        const { claimIdempotencyRequest } = await import('../../../server/utils/idempotency')
        const options = {
            db,
            event: makeEvent(key).event as never,
            scope: 'user:1',
            route: '/api/feedbacks',
            body: {},
        }
        const first = await claimIdempotencyRequest(options)
        const otherUser = await claimIdempotencyRequest({ ...options, scope: 'user:2' })
        const otherRoute = await claimIdempotencyRequest({ ...options, route: '/api/reports/user' })
        expect(new Set([first.id, otherUser.id, otherRoute.id]).size).toBe(3)
        database.sqlite
            .prepare('UPDATE idempotency_requests SET lease_expires_at = 0 WHERE id = ?')
            .run(first.id)
        expect(await claimIdempotencyRequest(options)).toMatchObject({
            id: first.id,
            replay: false,
        })
        await expect(claimIdempotencyRequest(options)).rejects.toMatchObject({ statusCode: 409 })
        await expect(
            claimIdempotencyRequest({ ...options, scope: 'user:2' }),
        ).rejects.toMatchObject({ statusCode: 409 })
        expect(
            database.sqlite.prepare('SELECT COUNT(*) AS count FROM idempotency_requests').get(),
        ).toEqual({ count: 3 })
    })

    it('requires a UUID Idempotency-Key', async () => {
        const { event } = makeEvent()
        const { claimIdempotencyRequest } = await import('../../../server/utils/idempotency')

        await expect(
            claimIdempotencyRequest({
                event: event as never,
                db,
                scope: 'user:1',
                route: '/api/feedbacks',
                body: {},
            }),
        ).rejects.toMatchObject({ statusCode: 400 })
    })

    it('allows only one parallel claim and returns Retry-After to the other', async () => {
        const firstEvent = makeEvent(key)
        const secondEvent = makeEvent(key)
        const { claimIdempotencyRequest } = await import('../../../server/utils/idempotency')
        const options = {
            db,
            scope: 'user:1',
            route: '/api/feedbacks',
            body: { comment: 'same' },
        }

        const results = await Promise.allSettled([
            claimIdempotencyRequest({ ...options, event: firstEvent.event as never }),
            claimIdempotencyRequest({ ...options, event: secondEvent.event as never }),
        ])

        expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
        const rejected = results.find((result) => result.status === 'rejected')
        expect(rejected).toMatchObject({ reason: { statusCode: 409 } })
        expect(
            firstEvent.setHeader.mock.calls.length + secondEvent.setHeader.mock.calls.length,
        ).toBe(1)
    })

    it('replays completed responses for the same canonical body and rejects a changed body', async () => {
        const { event } = makeEvent(key)
        const { claimIdempotencyRequest } = await import('../../../server/utils/idempotency')
        const first = await claimIdempotencyRequest({
            event: event as never,
            db,
            scope: 'user:1',
            route: '/api/reports/user',
            body: { first: 1, second: 2 },
        })
        first.resourceId = '42'
        await completeIdempotencyRequest(db, first, { id: 42 })

        const replay = await claimIdempotencyRequest({
            event: event as never,
            db,
            scope: 'user:1',
            route: '/api/reports/user',
            body: { second: 2, first: 1 },
        })
        expect(replay).toMatchObject({
            id: first.id,
            replay: true,
            response: { id: 42 },
            statusCode: 200,
        })

        await expect(
            claimIdempotencyRequest({
                event: event as never,
                db,
                scope: 'user:1',
                route: '/api/reports/user',
                body: { first: 99, second: 2 },
            }),
        ).rejects.toMatchObject({ statusCode: 409 })
    })
})
