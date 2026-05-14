import { afterEach, describe, expect, it, vi } from 'vitest'

const originalCronSecret = process.env.CRON_SECRET

const stubCronGlobals = (authorization?: string) => {
    const getSession = vi.fn()
    const forbiddenError = new Error('forbidden')
    const forbidden = vi.fn(() => {
        throw forbiddenError
    })

    vi.stubGlobal('eventHandler', <T>(handler: T) => handler)
    vi.stubGlobal('getHeaders', () => ({ authorization }))
    vi.stubGlobal('auth', { api: { getSession } })
    vi.stubGlobal('serverError', {
        forbidden,
        unauthorized: vi.fn(),
    })

    return { forbidden, forbiddenError, getSession }
}

afterEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()

    if (originalCronSecret === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = originalCronSecret
})

describe('cronEventHandler', () => {
    it('fails closed when CRON_SECRET is missing', async () => {
        delete process.env.CRON_SECRET

        const { forbidden, forbiddenError, getSession } = stubCronGlobals('Bearer undefined')
        const { cronEventHandler } = await import('../../server/utils/eventHandler')

        const handler = cronEventHandler(async () => 'ok')

        await expect(handler({} as never)).rejects.toBe(forbiddenError)
        expect(getSession).not.toHaveBeenCalled()
        expect(forbidden).toHaveBeenCalledWith({
            log: {
                tag: 'cronEventHandler',
                message: 'CRON_SECRET is not configured',
            },
        })
    })

    it('accepts a matching bearer token without loading a session', async () => {
        process.env.CRON_SECRET = 'secret'

        const { getSession } = stubCronGlobals('Bearer secret')
        const { cronEventHandler } = await import('../../server/utils/eventHandler')

        const handler = cronEventHandler(async () => 'ok')

        await expect(handler({} as never)).resolves.toBe('ok')
        expect(getSession).not.toHaveBeenCalled()
    })

    it('rejects an invalid bearer token without loading a session', async () => {
        process.env.CRON_SECRET = 'secret'

        const { forbidden, forbiddenError, getSession } = stubCronGlobals('Bearer nope')
        const { cronEventHandler } = await import('../../server/utils/eventHandler')

        const handler = cronEventHandler(async () => 'ok')

        await expect(handler({} as never)).rejects.toBe(forbiddenError)
        expect(getSession).not.toHaveBeenCalled()
        expect(forbidden).toHaveBeenCalledTimes(1)
    })
})
