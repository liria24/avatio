import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const limit = vi.fn()

beforeEach(() => {
    limit.mockReset()
    vi.stubGlobal('logger', () => ({ error: vi.fn() }))
    vi.stubGlobal('createError', (input: unknown) => input)
})

afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
})

describe('enforceRateLimit', () => {
    it('checks the configured Cloudflare Rate Limit binding with the provided key', async () => {
        vi.stubGlobal('__env__', {
            RATE_LIMIT_USER_ACTION: {
                limit,
            },
        })
        limit.mockResolvedValue({ success: true })
        const { enforceRateLimit } = await import('../../../server/utils/rateLimit')

        await enforceRateLimit({
            binding: 'RATE_LIMIT_USER_ACTION',
            key: 'feedback:fingerprint',
        })

        expect(limit).toHaveBeenCalledWith({ key: 'feedback:fingerprint' })
    })

    it('throws 429 when the binding rejects the key', async () => {
        vi.stubGlobal('__env__', {
            RATE_LIMIT_IMAGE: {
                limit,
            },
        })
        limit.mockResolvedValue({ success: false })
        const { enforceRateLimit } = await import('../../../server/utils/rateLimit')

        await expect(
            enforceRateLimit({
                binding: 'RATE_LIMIT_IMAGE',
                key: 'images:user-id',
            }),
        ).rejects.toMatchObject({
            status: 429,
            message: 'Too many requests. Please try again later.',
        })
    })

    it('allows requests when the binding is unavailable outside production', async () => {
        vi.stubGlobal('__env__', {})
        const { enforceRateLimit } = await import('../../../server/utils/rateLimit')

        await expect(
            enforceRateLimit({
                binding: 'RATE_LIMIT_DRAFT',
                key: 'drafts:user-id',
            }),
        ).resolves.toBeUndefined()
    })
})
