import type { CacheContext } from '@cloudflare/workers-types'
import { getCatalogCacheInvalidator, getCatalogRepository } from '~~/server/utils/catalogRuntime'
import { useDB } from '~~/server/utils/database'
import getItem from '~~/server/utils/getItem'
import type { Item, Platform } from '~~/shared/types/database'

/** Temporary rollout shape for messages already present in the physical queue. */
export interface ItemRevalidationMessage {
    id: Item['id']
    platform: Platform
    reason: 'setup-detail' | 'owned-avatars'
    requestedAt: string
    force?: boolean
}

export const isLegacyItemRevalidationMessage = (
    value: unknown,
): value is ItemRevalidationMessage => {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Partial<ItemRevalidationMessage>
    return (
        typeof candidate.id === 'string' &&
        (candidate.platform === 'booth' || candidate.platform === 'github') &&
        (candidate.reason === 'setup-detail' || candidate.reason === 'owned-avatars')
    )
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
