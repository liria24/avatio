import { syncCatalogSource } from '@avatio/core/catalog'
import type { CacheContext } from '@cloudflare/workers-types'
import { z } from 'zod'
import {
    getCatalogCacheInvalidator,
    getCatalogProviderRegistry,
    getCatalogRepository,
} from '~~/server/utils/catalogRuntime'
import { useDB } from '~~/server/utils/database'

import { ensureLegacyCatalogSource } from './migration'

const legacySchema = z.object({
    id: z.string().min(1),
    platform: z.enum(['booth', 'github']),
    reason: z.enum(['setup-detail', 'owned-avatars']),
    force: z.boolean().optional(),
    requestedAt: z.string().optional(),
})
const unfencedSchema = z.object({
    version: z.literal(2),
    type: z.literal('catalog.sync-source'),
    sourceId: z.string().min(1),
    leaseToken: z.undefined().optional(),
})
export type ItemRevalidationMessage = z.infer<typeof legacySchema>
type UnfencedMessage = z.infer<typeof unfencedSchema>
export const isLegacyItemRevalidationMessage = (value: unknown): value is ItemRevalidationMessage =>
    legacySchema.safeParse(value).success
export const isUnfencedCatalogMessage = (value: unknown): value is UnfencedMessage =>
    unfencedSchema.safeParse(value).success

/** Drain retained messages by acquiring a new lease; never borrow a current worker's token. */
export const handleItemRevalidationMessage = async (
    message: ItemRevalidationMessage | UnfencedMessage,
    cache?: CacheContext,
) => {
    const repository = getCatalogRepository()
    const source =
        'sourceId' in message
            ? await repository.findSource(message.sourceId)
            : await ensureLegacyCatalogSource(useDB(), message.platform, message.id)
    if (!source) return
    const now = new Date()
    if (source.syncLeaseUntil && source.syncLeaseUntil > now) return
    const lease = await repository.claimDueSource(
        source.id,
        now,
        new Date(now.getTime() + 30 * 60_000),
        'force' in message && message.force === true,
    )
    if (!lease) return
    try {
        return await syncCatalogSource({
            sourceId: source.id,
            leaseToken: lease.token,
            repository,
            providers: await getCatalogProviderRegistry(),
            cacheInvalidator: getCatalogCacheInvalidator(cache),
        })
    } catch (error) {
        await repository.releaseSourceLease(lease)
        throw error
    }
}
