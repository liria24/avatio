import type { ItemSourceId } from '../domain/catalog'
import type { CatalogRepository, SourceLease } from '../ports/catalog-repository'
import type { CatalogSyncQueue } from '../ports/catalog-sync-queue'

export interface EnqueueDueSourcesInput {
    sourceIds: readonly ItemSourceId[]
    repository: CatalogRepository
    queue: CatalogSyncQueue
    now?: Date
    leaseDurationMs?: number
}

export interface EnqueueDueSourcesResult {
    claimed: SourceLease[]
    enqueued: ItemSourceId[]
    failed: ItemSourceId[]
}

export const enqueueDueCatalogSources = async ({
    sourceIds,
    repository,
    queue,
    now = new Date(),
    leaseDurationMs = 30 * 60 * 1000,
}: EnqueueDueSourcesInput): Promise<EnqueueDueSourcesResult> => {
    const claimed: SourceLease[] = []
    const enqueued: ItemSourceId[] = []
    const failed: ItemSourceId[] = []
    const uniqueSourceIds = new Set(sourceIds)

    for (const sourceId of uniqueSourceIds) {
        const lease = await repository.claimDueSource(
            sourceId,
            now,
            new Date(now.getTime() + leaseDurationMs),
        )
        if (!lease) continue
        claimed.push(lease)

        try {
            await queue.enqueue({
                version: 2,
                type: 'catalog.sync-source',
                sourceId,
                leaseToken: lease.token,
            })
            enqueued.push(sourceId)
        } catch {
            failed.push(sourceId)
            await repository.releaseSourceLease(lease)
        }
    }

    return { claimed, enqueued, failed }
}
