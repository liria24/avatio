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

beforeEach(() => {
    vi.stubGlobal('logger', () => log)
    vi.stubGlobal('defineNitroPlugin', (plugin: (app: QueuePluginApp) => void) => plugin)
    log.error.mockReset()
})

afterEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
})

describe('item revalidation queue plugin', () => {
    it('acknowledges a stale fenced message without retrying or fetching', async () => {
        const markSyncStarted = vi.fn(async () => null)
        vi.stubGlobal('getCatalogRepository', () => ({ markSyncStarted }))
        vi.stubGlobal('getCatalogProviderRegistry', async () => ({}))
        vi.stubGlobal('getCatalogCacheInvalidator', () => ({}))
        const { default: plugin } = await import('../../../server/plugins/itemRevalidationQueue')
        let handler!: QueueHandler
        plugin({
            hooks: {
                hook: (_name, callback) => {
                    handler = callback
                },
            },
        })
        const message = {
            body: {
                version: 2,
                type: 'catalog.sync-source',
                sourceId: 'source',
                leaseToken: 'old',
            },
            ack: vi.fn(),
            retry: vi.fn(),
        }
        await handler({
            batch: { queue: 'item-revalidation', messages: [message] },
            context: { cache: {} },
        })
        expect(markSyncStarted).toHaveBeenCalledWith('source', 'old', expect.any(Date))
        expect(message.ack).toHaveBeenCalledOnce()
        expect(message.retry).not.toHaveBeenCalled()
    })
    it('rejects an unfenced retained message without fetching', async () => {
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

        expect(message.ack).not.toHaveBeenCalled()
        expect(message.retry).toHaveBeenCalledOnce()
        expect(log.error).toHaveBeenCalledOnce()
    })
})
