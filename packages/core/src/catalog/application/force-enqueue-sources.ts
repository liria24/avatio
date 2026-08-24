import type { ItemSourceId } from '../domain/catalog'
import type { CatalogRepository } from '../ports/catalog-repository'
import type { CatalogSyncQueue } from '../ports/catalog-sync-queue'
import { enqueueDueCatalogSources, type EnqueueDueSourcesResult } from './enqueue-due-sources'

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
