import { z } from 'zod'

const params = z.object({
    id: z.string(),
})

const query = z.object({
    platform: platformSchema.optional(),
})

const log = logger('/api/items/[id]:GET')

export default promiseEventHandler<Item>(async () => {
    const { id } = await validateParams(params)
    const { platform } = await validateQuery(query)

    log.info(`Processing item: ${id}, Platform: ${platform || 'auto-detect'}`)

    defineCacheControl({ cdnAge: 60 * 60 * 24, clientAge: 60 * 60 })

    return await getItem(platform, id)
})
