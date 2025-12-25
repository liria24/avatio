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
    async ({ session }) => {
        const { name, description, items, images, tags, coauthors } =
            await validateBody(body, { sanitize: true })

        const imageData = images?.length
            ? await Promise.all(
                  images.map(async (image) => {
                      const { colors, width, height } =
                          await extractImageColors(image)
                      return {
                          url: image,
                          width,
                          height,
                          themeColors: colors.length ? colors : null,
                      }
                  })
              )
            : []

        const setupId = await db.transaction(async (tx) => {
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
                        unsupported:
                            item.category === 'avatar'
                                ? false
                                : item.unsupported,
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

                if (shapekeys.length > 0)
                    await tx.insert(setupItemShapekeys).values(shapekeys)
            }

            if (imageData.length > 0) {
                await tx.insert(setupImages).values(
                    imageData.map((image) => ({
                        ...image,
                        setupId,
                    }))
                )
            }

            if (tags?.length)
                await tx.insert(setupTags).values(
                    tags.map((tag) => ({
                        setupId,
                        tag: tag.tag,
                    }))
                )

            if (coauthors?.length)
                await tx.insert(setupCoauthors).values(
                    coauthors.map((coauthor) => ({
                        setupId,
                        userId: coauthor.userId,
                        note: coauthor.note,
                    }))
                )

            return setupId
        })

        const data = await useEvent().$fetch(`/api/setups/${setupId}`)

        return data
    },
    {
        errorMessage: 'Failed to post setup.',
        requireSession: true,
        rejectBannedUser: true,
    }
)
