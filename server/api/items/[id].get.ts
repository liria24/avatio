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
    let { platform } = await validateQuery(query)

    log.log(`Processing item: ${id}, Platform: ${platform || 'auto-detect'}`)

    if (!platform) {
        const item = await getItemFromDatabase(transformItemId(id).decode())
        platform = item?.platform
    }

    defineCacheControl({ cdnAge: 60 * 60 * 24, clientAge: 60 * 60 })

    try {
        if (platform === 'booth') return await $fetch<Item>(`/api/items/booth/${id}`)
        else if (platform === 'github') return await $fetch<Item>(`/api/items/github/${id}`)
        else throw new Error()
    } catch {
        throw createError({
            status: 404,
            statusText: 'Item not found',
        })
    }
})
