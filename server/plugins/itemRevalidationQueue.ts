import { syncCatalogSource } from '@avatio/core/catalog'
import { catalogSyncMessageSchema } from '@avatio/core/contracts'
import { runCatalogMigrationChunk } from '~~/server/migration/catalog/migration'
import {
    catalogMigrationMessageSchema,
    enqueueCatalogMigration,
} from '~~/server/migration/catalog/queue'
import {
    handleItemRevalidationMessage,
    isLegacyItemRevalidationMessage,
    isUnfencedCatalogMessage,
} from '~~/server/migration/catalog/queueCompatibility'

const log = logger('itemRevalidationQueue')

export default defineNitroPlugin((nitroApp) => {
    nitroApp.hooks.hook('cloudflare:queue', async ({ batch, context }) => {
        if (!batch.queue.startsWith('item-revalidation')) return

        for (const message of batch.messages)
            try {
                if (catalogMigrationMessageSchema.safeParse(message.body).success) {
                    const result = await runCatalogMigrationChunk(useDB())
                    if (result.more) await enqueueCatalogMigration(result.run?.leaseToken ? 60 : 0)
                    message.ack()
                    continue
                }
                const v2Message = catalogSyncMessageSchema.safeParse(message.body)
                if (v2Message.success) {
                    const result = await syncCatalogSource({
                        sourceId: v2Message.data.sourceId,
                        leaseToken: v2Message.data.leaseToken,
                        repository: getCatalogRepository(),
                        providers: await getCatalogProviderRegistry(),
                        cacheInvalidator: getCatalogCacheInvalidator(context.cache),
                    })
                    if (result.cacheInvalidationFailed)
                        log.warn(
                            `Catalog source ${v2Message.data.sourceId} synced; cache purge failed`,
                        )
                } else if (
                    isLegacyItemRevalidationMessage(message.body) ||
                    isUnfencedCatalogMessage(message.body)
                ) {
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
