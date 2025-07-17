import database from '@@/database'
import {
    setupCoauthors,
    setupImages,
    setupItems,
    setupItemShapekeys,
    setups,
    setupTags,
} from '@@/database/schema'
import { extractColors } from 'extract-colors'
import getPixels from 'get-pixels'
import sharp from 'sharp'

const body = setupsInsertSchema

export default defineApi(
    async ({ session }) => {
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
                    unsupported:
                        item.category === 'avatar' ? false : item.unsupported,
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
                await database.insert(setupItemShapekeys).values(shapekeys)
        }

        if (images?.length)
            for (const image of images) {
                const blob = await $fetch<Blob>(image)
                const buffer = Buffer.from(await blob.arrayBuffer())
                const metadata = await sharp(buffer).metadata()
                const { width = 0, height = 0 } = metadata

                let colors: string[] = []

                colors = await new Promise((resolve, reject) => {
                    getPixels(image, async (err, pixels) => {
                        if (err) {
                            console.error('Error getting pixels:', err)
                            reject(err)
                            return
                        }

                        try {
                            const data = [...pixels.data]
                            const [width, height] = pixels.shape

                            const extractedColors = await extractColors(
                                { data, width, height },
                                {
                                    pixels: 64000,
                                    distance: 0.22,
                                    saturationDistance: 0.2,
                                    lightnessDistance: 0.2,
                                    hueDistance: 0.8,
                                }
                            )
                            resolve(
                                extractedColors
                                    .sort((a, b) => b.area - a.area)
                                    .map((color) => color.hex)
                            )
                        } catch (error) {
                            console.error('Error extracting colors:', error)
                            reject(error)
                        }
                    })
                })

                await database.insert(setupImages).values({
                    setupId,
                    url: image,
                    width,
                    height,
                    themeColors: colors.length ? colors : null,
                })
            }

        if (tags?.length)
            await database.insert(setupTags).values(
                tags.map((tag) => ({
                    setupId,
                    tag: tag.tag,
                }))
            )

        if (coauthors?.length)
            await database.insert(setupCoauthors).values(
                coauthors.map((coauthor) => ({
                    setupId,
                    userId: coauthor.userId,
                    note: coauthor.note,
                }))
            )

        const data = await useEvent().$fetch(`/api/setups/${setupId}`)

        return data
    },
    {
        errorMessage: 'Failed to post setup.',
        requireSession: true,
        rejectBannedUser: true,
    }
)
