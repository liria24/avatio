import database from '@@/database'
import {
    setupCoauthors,
    setupImages,
    setupItems,
    setupItemShapekeys,
    setups,
    setupTags,
} from '@@/database/schema'

const body = setupsInsertSchema

export default defineApi(
    async (session) => {
        const { name, description, items, images, tags, coauthors } =
            await validateBody(body, { sanitize: true })

        const resultSetups = await database
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

        const insertedItems = await database
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
                await database.insert(setupItemShapekeys).values(shapekeys)
            }
        }

        if (images?.length) {
            await database.insert(setupImages).values(
                images.map((image) => ({
                    setupId,
                    url: image.url,
                    width: image.width,
                    height: image.height,
                }))
            )
        }

        if (tags?.length) {
            await database.insert(setupTags).values(
                tags.map((tag) => ({
                    setupId,
                    tag: tag.tag,
                }))
            )
        }

        if (coauthors?.length) {
            await database.insert(setupCoauthors).values(
                coauthors.map((coauthor) => ({
                    setupId,
                    userId: coauthor.userId,
                    note: coauthor.note,
                }))
            )
        }

        const data = await useEvent().$fetch(`/api/setup/${setupId}`)

        return data
    },
    {
        errorMessage: 'Failed to post setup.',
        requireSession: true,
    }
)
