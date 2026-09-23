import { z } from 'zod'

export default promiseEventHandler(async ({ event, db }) => {
    const { id } = await validateParams(z.object({ id: z.string().min(1) }))
    const item = await queryCatalogItem(db, id)
    if (!item) throw serverError.notFound()
    runAfterResponse(enqueueReferencedCatalogSources([item.id]))
    applyPublicEdgeCache(event, [getCatalogItemCacheTag(item.id)])
    return item
})
