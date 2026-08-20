import type { CacheContext, Queue } from '@cloudflare/workers-types'
import type { H3Event } from 'h3'

const log = logger('itemRevalidationQueue')
const QUEUE_BINDING = 'ITEM_REVALIDATION_QUEUE'
const REVALIDATION_LOCK_TTL = 60 * 30

export interface ItemRevalidationMessage {
    id: Item['id']
    platform: Platform
    reason: 'setup-detail' | 'owned-avatars'
    requestedAt: string
}

type RevalidatableItem = Pick<Item, 'id' | 'platform'> & {
    updatedAt: string | number | Date
}

const getQueue = (event?: H3Event) => getRuntimeEnv(event)[QUEUE_BINDING] as Queue | undefined

const getLockKey = (id: Item['id'], platform: Platform) =>
    `item-revalidation:${platform}:${encodeURIComponent(id)}`

const shouldUseQueue = () => !import.meta.dev && process.env.NODE_ENV !== 'test'

export const isItemRevalidationDue = (item: Pick<RevalidatableItem, 'platform' | 'updatedAt'>) => {
    const maxAgeMs =
        item.platform === 'github' ? GITHUB_ITEM_CACHE_DURATION_MS : ITEM_CACHE_DURATION_MS
    return Date.now() - new Date(item.updatedAt).getTime() >= maxAgeMs
}

export const enqueueItemRevalidation = async (
    event: H3Event,
    item: RevalidatableItem,
    reason: ItemRevalidationMessage['reason'],
) => {
    if (!shouldUseQueue() || !isItemRevalidationDue(item)) return false

    const queue = getQueue(event)
    if (!queue) return false

    const lockKey = getLockKey(item.id, item.platform)
    const existingLock = await useStorage('cache').getItem(lockKey)
    if (existingLock) return false

    await useStorage('cache').setItem(lockKey, true, { ttl: REVALIDATION_LOCK_TTL })

    try {
        await queue.send({
            id: item.id,
            platform: item.platform,
            reason,
            requestedAt: new Date().toISOString(),
        } satisfies ItemRevalidationMessage)
        return true
    } catch (error) {
        await useStorage('cache').del(lockKey)
        log.error('Failed to enqueue item revalidation:', error)
        return false
    }
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
            cache,
        })
        persistedItemId = item.id
    } catch (error) {
        if (
            typeof error !== 'object' ||
            error === null ||
            !('statusCode' in error) ||
            error.statusCode !== 404
        )
            throw error
    }

    const relatedSetupItems = await db.query.setupItems.findMany({
        where: {
            itemId: { eq: persistedItemId },
        },
        columns: {
            setupId: true,
        },
    })

    const setupIds = [...new Set(relatedSetupItems.map((item) => item.setupId))]
    if (cache)
        await purgeEdgeCacheTagsWithContext(
            cache,
            [
                EDGE_CACHE_TAGS.items,
                EDGE_CACHE_TAGS.popularAvatars,
                EDGE_CACHE_TAGS.setups,
                ...setupIds.map((setupId) => getSetupCacheTag(setupId)),
            ],
            'item revalidation',
        )

    await useStorage('cache').del(getLockKey(message.id, message.platform))
}
