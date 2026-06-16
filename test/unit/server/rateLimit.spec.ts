import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const records = new Map<string, unknown>()
const storage = {
    getItem: vi.fn((key: string) => Promise.resolve(records.get(key))),
    setItem: vi.fn((key: string, value: unknown) => {
        records.set(key, value)
        return Promise.resolve()
    }),
}
const setResponseHeader = vi.fn()

beforeEach(() => {
    records.clear()
    storage.getItem.mockClear()
    storage.setItem.mockClear()
    setResponseHeader.mockClear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-17T00:00:00.000Z'))
    vi.stubGlobal('useStorage', () => storage)
    vi.stubGlobal('useEvent', () => ({}))
    vi.stubGlobal('setResponseHeader', setResponseHeader)
    vi.stubGlobal('logger', () => ({ error: vi.fn() }))
    vi.stubGlobal('createError', (input: unknown) => input)
})

afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.resetModules()
})

describe('enforceRateLimit', () => {
    it('allows requests up to the limit and stores a hashed key with ttl', async () => {
        const { enforceRateLimit } = await import('../../../server/utils/rateLimit')

        await enforceRateLimit({
            scope: 'feedback:create',
            identity: 'user@example.com',
            limit: 2,
            windowSeconds: 60,
        })

        expect(storage.setItem).toHaveBeenCalledWith(
            expect.not.stringContaining('user@example.com'),
            { count: 1, resetAt: Date.parse('2026-06-17T00:01:00.000Z') },
            { ttl: 120 },
        )
        expect(storage.setItem.mock.calls[0]?.[0]).toMatch(/^v1:feedback:create:[a-f0-9]{64}:/)
    })

    it('rejects requests over the limit with rate-limit headers', async () => {
        const { enforceRateLimit } = await import('../../../server/utils/rateLimit')
        const options = {
            scope: 'reports:item:create',
            identity: 'user-id',
            limit: 1,
            windowSeconds: 60,
        }

        await enforceRateLimit(options)

        await expect(enforceRateLimit(options)).rejects.toMatchObject({
            status: 429,
            message: 'Too many requests. Please try again later.',
        })
        expect(setResponseHeader).toHaveBeenCalledWith({}, 'Retry-After', 60)
        expect(setResponseHeader).toHaveBeenCalledWith({}, 'X-RateLimit-Limit', '1')
        expect(setResponseHeader).toHaveBeenCalledWith({}, 'X-RateLimit-Remaining', '0')
    })

    it('starts a new count in the next window', async () => {
        const { enforceRateLimit } = await import('../../../server/utils/rateLimit')
        const options = {
            scope: 'images:create',
            identity: 'user-id',
            limit: 1,
            windowSeconds: 60,
        }

        await enforceRateLimit(options)
        vi.setSystemTime(new Date('2026-06-17T00:01:01.000Z'))
        await enforceRateLimit(options)

        expect(storage.setItem).toHaveBeenCalledTimes(2)
    })
})
