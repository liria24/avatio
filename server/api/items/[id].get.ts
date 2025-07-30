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
        const { platform } = await validateQuery(query)

        consola.log(
            `Processing item: ${id}, Platform: ${platform || 'auto-detect'}`
        )

        const item = await getItem(id, { platform })

        if (!item)
            throw createError({
                statusCode: 404,
                statusMessage: 'Item not found',
            })

        return item
    },
    {
        errorMessage: 'Failed to get items.',
    }
)
