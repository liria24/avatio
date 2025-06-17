import database from '@@/database'
import { z } from 'zod/v4'

const params = z.object({
    id: z.union([z.string().transform((val) => Number(val)), z.number()]),
})

export default defineApi<Setup>(
    async () => {
        const { id } = await validateParams(params)

        const data = await database.query.setups.findFirst({
            where: (setups, { eq, and }) =>
                and(eq(setups.id, id), eq(setups.visibility, true)),
            columns: {
                id: true,
                createdAt: true,
                updatedAt: true,
                name: true,
                description: true,
            },
            with: {
                user: {
                    columns: {
                        id: true,
                        createdAt: true,
                        name: true,
                        image: true,
                        bio: true,
                        links: true,
                    },
                    with: {
                        badges: {
                            columns: {
                                badge: true,
                                createdAt: true,
                            },
                        },
                        shops: {
                            columns: {
                                id: true,
                                createdAt: true,
                            },
                            with: {
                                shop: {
                                    columns: {
                                        id: true,
                                        name: true,
                                        image: true,
                                        verified: true,
                                    },
                                },
                            },
                        },
                    },
                },
                items: {
                    columns: {
                        unsupported: true,
                    },
                    with: {
                        item: {
                            columns: {
                                id: true,
                                updatedAt: true,
                                source: true,
                                category: true,
                                name: true,
                                image: true,
                                price: true,
                                likes: true,
                                nsfw: true,
                            },
                            with: {
                                shop: {
                                    columns: {
                                        id: true,
                                        name: true,
                                        image: true,
                                        verified: true,
                                    },
                                },
                            },
                        },
                        shapekeys: {
                            columns: {
                                name: true,
                                value: true,
                            },
                        },
                    },
                },
                images: {
                    columns: {
                        url: true,
                        width: true,
                        height: true,
                    },
                },
                tags: {
                    columns: {
                        tag: true,
                    },
                },
                coauthors: {
                    columns: {
                        userId: true,
                        note: true,
                    },
                },
                tools: {
                    columns: {
                        toolId: true,
                        note: true,
                    },
                },
            },
        })

        if (!data)
            throw createError({
                statusCode: 404,
                statusMessage: 'Setup not found',
            })

        const items: SetupItem[] = []

        for (const item of data.items) {
            const timeDifference =
                new Date().getTime() - new Date(item.item.updatedAt).getTime()
            if (timeDifference < 24 * 60 * 60 * 1000)
                items.push({
                    ...item.item,
                    unsupported: item.unsupported,
                    shapekeys: item.shapekeys,
                })
            else {
                try {
                    const response = await useEvent().$fetch<Item>(
                        `/api/item/booth/${item.item.id}`
                    )
                    items.push({
                        ...response,
                        unsupported: item.unsupported,
                        shapekeys: item.shapekeys,
                    })
                } catch (error) {
                    console.error(error)
                }
            }
        }

        return {
            id: data.id,
            createdAt: data.createdAt.toISOString(),
            updatedAt: data.updatedAt.toISOString(),
            user: {
                id: data.user.id,
                createdAt: data.user.createdAt.toISOString(),
                name: data.user.name,
                image: data.user.image,
                bio: data.user.bio,
                links: data.user.links,
                badges: data.user.badges.map((badge) => ({
                    badge: badge.badge,
                    createdAt: badge.createdAt.toISOString(),
                })),
                shops: data.user.shops.map((shop) => ({
                    id: shop.id,
                    createdAt: shop.createdAt.toISOString(),
                    shop: {
                        id: shop.shop.id,
                        name: shop.shop.name,
                        image: shop.shop.image,
                        verified: shop.shop.verified,
                    },
                })),
            },
            name: data.name,
            description: data.description,
            items,
            images: data.images,
            tags: data.tags,
            coauthors: data.coauthors,
            tools: data.tools,
        }
    },
    {
        errorMessage: 'Failed to get setups',
    }
)
