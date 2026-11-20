import type { ItemSourceId } from '../domain/catalog'
import type { CatalogRepository, CatalogSyncQueue, SourceLease } from '../ports'

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

export interface ForceEnqueueCatalogSourcesInput {
    sourceIds: readonly ItemSourceId[]
    repository: CatalogRepository
    queue: CatalogSyncQueue
    now?: Date
}

export interface ForceEnqueueCatalogSourcesResult extends EnqueueDueSourcesResult {
    notFound: ItemSourceId[]
}

export const forceEnqueueCatalogSources = async ({
    sourceIds,
    repository,
    queue,
    now = new Date(),
}: ForceEnqueueCatalogSourcesInput): Promise<ForceEnqueueCatalogSourcesResult> => {
    const scheduled: ItemSourceId[] = []
    const notFound: ItemSourceId[] = []

    for (const sourceId of new Set(sourceIds)) {
        if (await repository.scheduleSourceCheck(sourceId, now)) scheduled.push(sourceId)
        else notFound.push(sourceId)
    }

    return {
        ...(await enqueueDueCatalogSources({ sourceIds: scheduled, repository, queue, now })),
        notFound,
    }
}
