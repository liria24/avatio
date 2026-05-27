import { z } from 'zod'

const bodySchema = z.object({
    allowedBoothCategoryId: z.number().int().array().optional(),
    forceUpdateItem: z.boolean().optional(),
    isMaintenance: z.boolean().optional(),
    specificItemCategories: z
        .object({
            booth: z.record(z.string(), itemCategorySchema).optional(),
            github: z.record(z.string(), itemCategorySchema).optional(),
        })
        .optional(),
})

export default adminSessionEventHandler(async () => {
    const body = await validateBody(bodySchema)
    return await updateAppFlags(body)
})
