import { allowedBoothCategories, itemCategoryOverrides } from '@@/database/schema'
import { z } from 'zod'

const itemCategorySchema = z.enum([
    'avatar',
    'clothing',
    'accessory',
    'hair',
    'shader',
    'texture',
    'tool',
    'other',
])

const configSchema = z.object({
    allowedBoothCategoryId: z
        .number()
        .int()
        .array()
        .transform((ids) => [...new Set(ids)].sort((a, b) => a - b))
        .default([]),
    forceUpdateItem: z.boolean().default(false),
    isMaintenance: z.boolean().default(false),
    specificItemCategories: z
        .object({
            booth: z.record(z.string(), itemCategorySchema).default({}),
            github: z.record(z.string(), itemCategorySchema).default({}),
        })
        .default({ booth: {}, github: {} }),
})

export default adminSessionEventHandler(async ({ db, event }) => {
    const config = await validateBody(configSchema, { sanitize: true })
    const queries = [
        db.delete(allowedBoothCategories),
        db.delete(itemCategoryOverrides),
    ] as Parameters<typeof executeD1Batch>[1]

    if (config.allowedBoothCategoryId.length)
        queries.push(
            db
                .insert(allowedBoothCategories)
                .values(config.allowedBoothCategoryId.map((categoryId) => ({ categoryId }))),
        )

    const rows = (['booth', 'github'] as const).flatMap((platform) =>
        Object.entries(config.specificItemCategories[platform]).map(([itemId, category]) => ({
            platform,
            itemId,
            category,
        })),
    )
    if (rows.length) queries.push(db.insert(itemCategoryOverrides).values(rows))

    await executeD1Batch(db, queries)
    return readAppConfig(db, event)
})
