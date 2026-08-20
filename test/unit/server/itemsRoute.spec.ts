import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

interface ResolutionOptions {
    allowExternalResolution: boolean
    beforeExternalResolution?: () => Promise<void>
}

interface RouteContext {
    event: object
    session: { user: { id: string; banned: boolean } } | null
    db: object
}

const enforceRateLimit = vi.fn()
const getItem = vi.fn()

beforeEach(() => {
    enforceRateLimit.mockReset().mockResolvedValue(undefined)
    getItem
        .mockReset()
        .mockImplementation(
            async (
                _event: object,
                _db: object,
                _id: string,
                _platform: string,
                options: ResolutionOptions,
            ) => {
                await options.beforeExternalResolution?.()
                return { id: 'owner/repo' }
            },
        )
    vi.stubGlobal('logger', () => ({ info: vi.fn() }))
    vi.stubGlobal('platformSchema', z.enum(['booth', 'github']))
    vi.stubGlobal('sessionEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('validateParams', vi.fn().mockResolvedValue({ id: 'owner/repo' }))
    vi.stubGlobal('validateQuery', vi.fn().mockResolvedValue({ platform: 'github' }))
    vi.stubGlobal('enforceRateLimit', enforceRateLimit)
    vi.stubGlobal('getItem', getItem)
})

afterEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
})

const loadRoute = async () =>
    (await import('../../../server/api/items/[...id].get')).default as unknown as (
        context: RouteContext,
    ) => Promise<unknown>

describe('GET /api/items/[...id] admission', () => {
    it('keeps anonymous requests on the cached-only path', async () => {
        const route = await loadRoute()
        const context: RouteContext = { event: {}, session: null, db: {} }

        await route(context)

        expect(getItem).toHaveBeenCalledWith(context.event, context.db, 'owner/repo', 'github', {
            allowExternalResolution: false,
        })
        expect(enforceRateLimit).not.toHaveBeenCalled()
    })

    it('rate limits an active user before enabling external resolution', async () => {
        const route = await loadRoute()
        const context: RouteContext = {
            event: {},
            session: { user: { id: 'user-1', banned: false } },
            db: {},
        }

        await route(context)

        expect(enforceRateLimit).toHaveBeenCalledWith({
            binding: 'RATE_LIMIT_USER_ACTION',
            key: 'item-resolution:user-1',
        })
        expect(getItem).toHaveBeenCalledWith(
            context.event,
            context.db,
            'owner/repo',
            'github',
            expect.objectContaining({ allowExternalResolution: true }),
        )
    })

    it('keeps banned users on the cached-only path', async () => {
        const route = await loadRoute()
        const context: RouteContext = {
            event: {},
            session: { user: { id: 'user-1', banned: true } },
            db: {},
        }

        await route(context)

        expect(getItem).toHaveBeenCalledWith(context.event, context.db, 'owner/repo', 'github', {
            allowExternalResolution: false,
        })
        expect(enforceRateLimit).not.toHaveBeenCalled()
    })
})
