import { syncCatalogSource } from '@avatio/core/catalog'
import { catalogSyncMessageSchema } from '@avatio/core/contracts'

const log = logger('itemRevalidationQueue')

const isLegacyMessage = (value: unknown): value is ItemRevalidationMessage => {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Partial<ItemRevalidationMessage>
    return (
        typeof candidate.id === 'string' &&
        (candidate.platform === 'booth' || candidate.platform === 'github') &&
        (candidate.reason === 'setup-detail' || candidate.reason === 'owned-avatars')
    )
}

export default defineNitroPlugin((nitroApp) => {
    nitroApp.hooks.hook('cloudflare:queue', async ({ batch, context }) => {
        if (!batch.queue.startsWith('item-revalidation')) return

        for (const message of batch.messages)
            try {
                const v2Message = catalogSyncMessageSchema.safeParse(message.body)
                if (v2Message.success) {
                    const result = await syncCatalogSource({
                        sourceId: v2Message.data.sourceId,
                        repository: getCatalogRepository(),
                        providers: await getCatalogProviderRegistry(),
                        cacheInvalidator: getCatalogCacheInvalidator(context.cache),
                    })
                    if (result.cacheInvalidationFailed)
                        log.warn(
                            `Catalog source ${v2Message.data.sourceId} synced; cache purge failed`,
                        )
                } else if (isLegacyMessage(message.body)) {
                    await handleItemRevalidationMessage(message.body, context.cache)
                } else {
                    throw new Error('Unsupported catalog synchronization message')
                }
                message.ack()
            } catch (error) {
                log.error('Failed to revalidate item from queue:', error)
                message.retry()
            }
    })
})
