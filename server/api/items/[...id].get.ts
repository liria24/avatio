import { z } from 'zod'

export default requestEventHandler(async ({ event, db }) => {
    const { id } = validateRequestParams(event, z.object({ id: z.string().min(1) }))
    const item = await queryCatalogItem(db, id)
    if (!item) throw serverError.notFound()
    runAfterResponse(enqueueReferencedCatalogSources([item.id]))
    applyPublicRequestCache(event, [getCatalogItemCacheTag(item.id)])
    return item
})
