import { enqueueDueCatalogSources } from '@avatio/core/catalog'
import { z } from 'zod'

const params = z.object({ id: z.string() })

export default promiseEventHandler<Setup>(async ({ event, db }) => {
    const { id } = await validateParams(params)
    const result = await querySetupProjection(db, id)
    if (!result) throw serverError.notFound()

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

    return result.setup
})
