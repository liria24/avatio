import database from '@@/database'
import { setups } from '@@/database/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod/v4'

const params = z.object({
    id: z.union([z.string().transform((val) => Number(val)), z.number()]),
})
const body = z.object({
    hide: z.union([z.boolean(), z.stringbool()]).optional(),
    hideReason: z.string().optional(),
})

export default defineApi(
    async () => {
        const { id } = await validateParams(params)
        const { hide, hideReason } = await validateBody(body)

        if (hide !== undefined)
            await database
                .update(setups)
                .set({
                    hidAt: hide ? new Date() : null,
                    hidReason: hide ? hideReason || null : null,
                })
                .where(eq(setups.id, id))

        return null
    },
    {
        errorMessage: 'Failed to patch setup.',
        requireAdmin: true,
    }
)
