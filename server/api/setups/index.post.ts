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

        const imageData = await Promise.all(
            (images || []).map(async (url) => {
                const { colors, width, height } = await extractImageColors(url)
                return {
                    url,
                    width,
                    height,
                    themeColors: colors.length ? colors : null,
                }
            })
        )

        const setupId = await db.transaction(async (tx) => {
            const [setup] = await tx
                .insert(setups)
                .values({
                    userId: session.user.id,
                    name,
                    description,
                })
                .returning({
                    id: setups.id,
                })

            const setupId = setup.id

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
                .returning({ id: setupItems.id })

            const shapekeys = items.flatMap((item, i) =>
                (item.shapekeys || []).map((s) => ({
                    setupItemId: insertedItems[i].id,
                    ...s,
                }))
            )

            await Promise.all(
                [
                    shapekeys.length &&
                        tx.insert(setupItemShapekeys).values(shapekeys),
                    imageData.length &&
                        tx
                            .insert(setupImages)
                            .values(
                                imageData.map((img) => ({ ...img, setupId }))
                            ),
                    tags?.length &&
                        tx
                            .insert(setupTags)
                            .values(tags.map((t) => ({ setupId, tag: t.tag }))),
                    coauthors?.length &&
                        tx
                            .insert(setupCoauthors)
                            .values(coauthors.map((c) => ({ setupId, ...c }))),
                ].filter(Boolean)
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
