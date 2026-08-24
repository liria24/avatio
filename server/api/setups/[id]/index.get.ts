import { enqueueDueCatalogSources } from '@avatio/core/catalog'
import { z } from 'zod'

const params = z.object({ id: z.string() })

export default promiseEventHandler<Setup>(async ({ event, db }) => {
    const { id } = await validateParams(params)
    const result = await querySetupProjection(db, id)
    if (!result) throw serverError.notFound()

    if (result.v2) {
        const queue = getCatalogSyncQueue()
        if (queue && result.sourceIds.length)
            runAfterResponse(
                enqueueDueCatalogSources({
                    sourceIds: result.sourceIds,
                    repository: getCatalogRepository(),
                    queue,
                }),
            )
        applyPublicEdgeCache(event, [
            getSetupCacheTag(id),
            ...result.catalogItemIds.map(getCatalogItemCacheTag),
        ])
    } else {
        if (result.legacyRevalidationItems.length)
            runAfterResponse(enqueueReferencedCatalogSources(result.legacyRevalidationItems))
        applyPublicEdgeCache(event, [getSetupCacheTag(id)])
    }

    return result.setup
})
