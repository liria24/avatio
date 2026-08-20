import { createError } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'

interface StoredRequest {
    id: string
    scope: string
    route: string
    key: string
    requestHash: string
    status: 'pending' | 'completed'
    resourceId: string | null
    response: unknown
    statusCode: number | null
    leaseExpiresAt: Date
    expiresAt: Date
    createdAt: Date
    updatedAt: Date
}

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

const makeDb = () => {
    const state: { value?: StoredRequest } = {}
    const findFirst = vi.fn(async () => state.value)
    const db = {
        query: { idempotencyRequests: { findFirst } },
        insert: vi.fn(() => ({
            values: (
                values: Omit<
                    StoredRequest,
                    'createdAt' | 'updatedAt' | 'status' | 'response' | 'statusCode'
                >,
            ) => ({
                onConflictDoNothing: () => ({
                    returning: async () => {
                        await Promise.resolve()
                        if (state.value) return []
                        const now = new Date()
                        state.value = {
                            ...values,
                            resourceId: values.resourceId ?? null,
                            status: 'pending',
                            response: null,
                            statusCode: null,
                            createdAt: now,
                            updatedAt: now,
                        }
                        return [{ id: values.id }]
                    },
                }),
            }),
        })),
        update: vi.fn(() => ({
            set: (values: Partial<StoredRequest>) => ({
                where: () => ({
                    returning: async () => {
                        if (!state.value) return []
                        Object.assign(state.value, values)
                        return [{ id: state.value.id }]
                    },
                }),
            }),
        })),
    }
    return { db, state }
}

describe('idempotency request claims', () => {
    beforeEach(() => vi.stubGlobal('createError', createError))

    it('requires a UUID Idempotency-Key', async () => {
        const { event } = makeEvent()
        const { db } = makeDb()
        const { claimIdempotencyRequest } = await import('../../../server/utils/idempotency')

        await expect(
            claimIdempotencyRequest({
                event: event as never,
                db: db as never,
                scope: 'user:1',
                route: '/api/feedbacks',
                body: {},
            }),
        ).rejects.toMatchObject({ statusCode: 400 })
    })

    it('allows only one parallel claim and returns Retry-After to the other', async () => {
        const firstEvent = makeEvent(key)
        const secondEvent = makeEvent(key)
        const { db } = makeDb()
        const { claimIdempotencyRequest } = await import('../../../server/utils/idempotency')
        const options = {
            db: db as never,
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
        const { db, state } = makeDb()
        const { claimIdempotencyRequest } = await import('../../../server/utils/idempotency')
        const first = await claimIdempotencyRequest({
            event: event as never,
            db: db as never,
            scope: 'user:1',
            route: '/api/reports/user',
            body: { first: 1, second: 2 },
        })
        Object.assign(state.value!, {
            status: 'completed',
            response: { id: 42 },
            statusCode: 200,
            resourceId: '42',
        })

        const replay = await claimIdempotencyRequest({
            event: event as never,
            db: db as never,
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
                db: db as never,
                scope: 'user:1',
                route: '/api/reports/user',
                body: { first: 99, second: 2 },
            }),
        ).rejects.toMatchObject({ statusCode: 409 })
    })
})
