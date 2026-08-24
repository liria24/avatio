import type { CacheContext } from '@cloudflare/workers-types'

/** Temporary rollout shape for messages already present in the physical queue. */
export interface ItemRevalidationMessage {
    id: Item['id']
    platform: Platform
    reason: 'setup-detail' | 'owned-avatars'
    requestedAt: string
    force?: boolean
}

export const handleItemRevalidationMessage = async (
    message: ItemRevalidationMessage,
    cache?: CacheContext,
) => {
    const db = useDB()
    let persistedItemId = message.id
    try {
        const item = await getItem(undefined, db, message.id, message.platform, {
            allowExternalResolution: true,
            forceRefresh: message.force === true,
        })
        persistedItemId = item.id
    } catch (error) {
        if (
            typeof error !== 'object' ||
            error === null ||
            !('statusCode' in error) ||
            error.statusCode !== 404 ||
            !('reason' in error)
        )
            throw error
    }

    const repository = getCatalogRepository()
    const source =
        (await repository.findSourceByExternalId(message.platform, persistedItemId)) ??
        (persistedItemId === message.id
            ? null
            : await repository.findSourceByExternalId(message.platform, message.id))
    if (source)
        await getCatalogCacheInvalidator(cache).invalidate({
            items: [source.itemId],
        })
}
