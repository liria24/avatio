import { items } from '@@/database/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const params = z.object({
    id: z.string(),
})

const body = itemsUpdateSchema.pick({
    niceName: true,
})

export default adminSessionEventHandler(async ({ event, db }) => {
    const { id } = await validateParams(params)
    const { niceName } = await validateBody(body, { sanitize: true })

    await db.update(items).set({ niceName }).where(eq(items.id, id))
    await purgeEdgeCacheTags(event, [EDGE_CACHE_TAGS.items], 'admin item name update')

    const data = await useEvent().$fetch<Item>(`/api/items/${id}`)

    return data
})
