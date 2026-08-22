import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type QueueMessage = {
    body: unknown
    ack: () => void
    retry: () => void
}

type QueueHandler = (payload: {
    batch: { queue: string; messages: QueueMessage[] }
    context: { cache: unknown }
}) => Promise<void>

type QueuePluginApp = {
    hooks: {
        hook: (name: string, handler: QueueHandler) => void
    }
}

const log = { error: vi.fn() }
const handleMessage = vi.fn()

beforeEach(() => {
    vi.stubGlobal('logger', () => log)
    vi.stubGlobal('handleItemRevalidationMessage', handleMessage)
    vi.stubGlobal('defineNitroPlugin', (plugin: (app: QueuePluginApp) => void) => plugin)
    handleMessage.mockReset().mockResolvedValue(undefined)
    log.error.mockReset()
})

afterEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
})

describe('item revalidation queue plugin', () => {
    it('handles the stage-specific development queue', async () => {
        const { default: plugin } = await import('../../../server/plugins/itemRevalidationQueue')
        let queueHandler!: QueueHandler
        plugin({
            hooks: {
                hook: (_name, handler) => {
                    queueHandler = handler
                },
            },
        })

        const message: QueueMessage = {
            body: {
                id: 'owner/repo',
                platform: 'github',
                reason: 'setup-detail',
                requestedAt: new Date().toISOString(),
            },
            ack: vi.fn(),
            retry: vi.fn(),
        }
        const cache = {}

        await queueHandler({
            batch: { queue: 'item-revalidation-development', messages: [message] },
            context: { cache },
        })

        expect(handleMessage).toHaveBeenCalledWith(message.body, cache)
        expect(message.ack).toHaveBeenCalledOnce()
        expect(message.retry).not.toHaveBeenCalled()
    })
})
