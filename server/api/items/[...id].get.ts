import { z } from 'zod'

const params = z.object({
    id: z.string(),
})

const query = z.object({
    platform: platformSchema.optional(),
})

const log = logger('/api/items/[id]:GET')

export default sessionEventHandler<Item>(async ({ event, session, db }) => {
    const { id } = await validateParams(params)
    const { platform } = await validateQuery(query)
    const userId = session?.user.banned ? undefined : session?.user.id

    log.info(`Processing item: ${id}, Platform: ${platform || 'auto-detect'}`)

    return await getItem(
        event,
        db,
        id,
        platform,
        userId
            ? {
                  allowExternalResolution: true,
                  beforeExternalResolution: () =>
                      enforceRateLimit({
                          binding: 'RATE_LIMIT_USER_ACTION',
                          key: `item-resolution:${userId}`,
                      }),
              }
            : { allowExternalResolution: false },
    )
})
