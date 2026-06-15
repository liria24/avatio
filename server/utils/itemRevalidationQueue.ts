import type { H3Event } from 'h3'
import type { Queue } from '@cloudflare/workers-types'
const log = logger('itemRevalidationQueue')
const QUEUE_BINDING = 'ITEM_REVALIDATION_QUEUE'
const REVALIDATION_LOCK_TTL = 60 * 30

type RuntimeEnv = Record<string, unknown>

export interface ItemRevalidationMessage {
    id: Item['id']
    platform: Platform
    reason: 'setup-detail' | 'owned-avatars'
    requestedAt: string
}

const getRuntimeEnv = (event?: H3Event): RuntimeEnv => {
    const g = globalThis as typeof globalThis & { __env__?: RuntimeEnv }
    if (g.__env__) return g.__env__
    return (event?.context.cloudflare?.env ?? process.env) as RuntimeEnv
}

const getQueue = (event?: H3Event) => getRuntimeEnv(event)[QUEUE_BINDING] as Queue | undefined

const getLockKey = (id: Item['id'], platform: Platform) =>
    `item-revalidation:${platform}:${encodeURIComponent(id)}`

const shouldUseQueue = () => !import.meta.dev && process.env.NODE_ENV !== 'test'

export const isItemRevalidationDue = (item: Pick<Item, 'platform' | 'updatedAt'>) => {
    const maxAgeMs =
        item.platform === 'github' ? GITHUB_ITEM_CACHE_DURATION_MS : ITEM_CACHE_DURATION_MS
    return Date.now() - new Date(item.updatedAt).getTime() >= maxAgeMs
}

export const enqueueItemRevalidation = async (
    event: H3Event,
    item: Pick<Item, 'id' | 'platform' | 'updatedAt'>,
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

export const handleItemRevalidationMessage = async (message: ItemRevalidationMessage) => {
    const db = useDB()
    await getItem(undefined, db, message.id, message.platform)

    const relatedSetupItems = await db.query.setupItems.findMany({
        where: {
            itemId: { eq: message.id },
        },
        columns: {
            setupId: true,
        },
    })

    await Promise.all(
        [...new Set(relatedSetupItems.map((item) => item.setupId))].map((setupId) =>
            purgeSetupCache(setupId),
        ),
    )

    await useStorage('cache').del(getLockKey(message.id, message.platform))
}

export const clearItemRevalidationLock = async (message: ItemRevalidationMessage) => {
    await useStorage('cache').del(getLockKey(message.id, message.platform))
}
