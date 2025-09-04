import database from '@@/database'
import { items } from '@@/database/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const params = z.object({
    id: z.string(),
})

const body = itemsUpdateSchema.pick({
    niceName: true,
})

export default defineApi(
    async () => {
        const { id } = await validateParams(params)

        const { niceName } = await validateBody(body, { sanitize: true })

        await database.update(items).set({ niceName }).where(eq(items.id, id))

        const data = await useEvent().$fetch<Item>(`/api/items/${id}`)

        return data
    },
    {
        errorMessage: 'Failed to update item.',
        requireAdmin: true,
    }
)
