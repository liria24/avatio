import { enqueueDueCatalogSources } from '@avatio/core/catalog'
import { z } from 'zod'

const params = z.object({ id: z.string() })

export default authedSessionEventHandler(async ({ event, session, db, services }) => {
    const { id } = await validateParams(params)
    const result = await querySetupProjection(
        db,
        id,
        { userId: session.user.id, role: session.user.role },
        await canUseSetupItemPoints(services),
    )
    if (!result) throw serverError.notFound()

    applyNoStoreCache(event)
    const queue = getCatalogSyncQueue()
    if (queue && result.sourceIds.length)
        runAfterResponse(
            enqueueDueCatalogSources({
                sourceIds: result.sourceIds,
                repository: getCatalogRepository(),
                queue,
            }),
        )

    return result.setup
})
