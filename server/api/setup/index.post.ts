import database from '@@/database'
import {
    setupCoauthors,
    setupImages,
    setupItems,
    setupItemShapekeys,
    setups,
    setupTags,
    setupTools,
} from '@@/database/schema'

const body = setupsInsertSchema
    .pick({
        name: true,
        description: true,
    })
    .extend({
        items: setupItemsInsertSchema
            .omit({ setupId: true })
            .extend({
                shapekeys: setupItemShapekeysInsertSchema
                    .omit({ setupItemId: true })
                    .array()
                    .optional(),
            })
            .array()
            .min(1),
        images: setupImagesInsertSchema
            .omit({ setupId: true })
            .array()
            .max(1)
            .optional(),
        tags: setupTagsInsertSchema.omit({ setupId: true }).array().optional(),
        coauthors: setupCoauthorsInsertSchema
            .omit({ setupId: true })
            .array()
            .optional(),
        tools: setupToolsInsertSchema
            .omit({ setupId: true })
            .array()
            .optional(),
    })

export default defineApi(
    async (session) => {
        const { name, description, items, images, tags, coauthors, tools } =
            await validateBody(body)

        const result = await database.transaction(async (tx) => {
            const resultSetups = await tx
                .insert(setups)
                .values({
                    userId: session.user.id,
                    name,
                    description,
                })
                .returning({
                    id: setups.id,
                })

            const setupId = resultSetups[0].id

            const insertedItems = await tx
                .insert(setupItems)
                .values(
                    items.map((item) => ({
                        setupId,
                        itemId: item.itemId,
                        category: item.category,
                        note: item.note,
                    }))
                )
                .returning({
                    id: setupItems.id,
                    itemId: setupItems.itemId,
                })

            if (items.some((item) => item.shapekeys?.length)) {
                const shapekeys = items.flatMap((item, index) => {
                    const setupItemId = insertedItems[index].id
                    return (
                        item.shapekeys?.map((shapekey) => ({
                            setupItemId,
                            name: shapekey.name,
                            value: shapekey.value,
                        })) || []
                    )
                })

                if (shapekeys.length > 0) {
                    await tx.insert(setupItemShapekeys).values(shapekeys)
                }
            }

            if (images?.length) {
                await tx.insert(setupImages).values(
                    images.map((image) => ({
                        setupId,
                        url: image.url,
                        width: image.width,
                        height: image.height,
                    }))
                )
            }

            if (tags?.length) {
                await tx.insert(setupTags).values(
                    tags.map((tag) => ({
                        setupId,
                        tag: tag.tag,
                    }))
                )
            }

            if (coauthors?.length) {
                await tx.insert(setupCoauthors).values(
                    coauthors.map((coauthor) => ({
                        setupId,
                        userId: coauthor.userId,
                        note: coauthor.note,
                    }))
                )
            }

            if (tools?.length) {
                await tx.insert(setupTools).values(
                    tools.map((tool) => ({
                        setupId,
                        toolId: tool.toolId,
                        note: tool.note,
                    }))
                )
            }

            return setupId
        })

        const data = await useEvent().$fetch(`/api/setup/${result}`)

        return data
    },
    {
        errorMessage: 'Failed to post setup.',
        requireSession: true,
    }
)
