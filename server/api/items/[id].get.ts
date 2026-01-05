import { consola } from 'consola'
import { z } from 'zod'

const params = z.object({
    id: z.string(),
})

const query = z.object({
    platform: platformSchema.optional(),
})

export default defineApi<Item>(
    async () => {
        const { id } = await validateParams(params)
        let { platform } = await validateQuery(query)

        consola.log(`Processing item: ${id}, Platform: ${platform || 'auto-detect'}`)

        if (!platform) {
            const item = await getItemFromDatabase(transformItemId(id).decode())
            platform = item?.platform
        }

        try {
            if (platform === 'booth') return await $fetch<Item>(`/api/items/booth/${id}`)
            else if (platform === 'github') return await $fetch<Item>(`/api/items/github/${id}`)
            else throw new Error()
        } catch {
            throw createError({
                statusCode: 404,
                statusMessage: 'Item not found',
            })
        }
    },
    {
        errorMessage: 'Failed to get items.',
    }
)
