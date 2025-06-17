import database from '@@/database'
import { z } from 'zod/v4'

const params = z.object({
    id: z.string(),
})

export default defineApi<UserWithSetups>(
    async () => {
        const { id } = await validateParams(params)

        const data = await database.query.user.findFirst({
            where: (user, { eq }) => eq(user.id, id),
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
                setups: {
                    columns: {
                        id: true,
                        createdAt: true,
                        updatedAt: true,
                        name: true,
                        description: true,
                    },
                    with: {
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
                },
            },
        })

        if (!data)
            throw createError({
                statusCode: 404,
                statusMessage: 'User not found',
            })

        return {
            id: data.id,
            createdAt: data.createdAt.toISOString(),
            name: data.name,
            image: data.image,
            bio: data.bio,
            links: data.links,
            badges: data.badges?.map((badge) => ({
                badge: badge.badge,
                createdAt: badge.createdAt.toISOString(),
            })),
            shops: data.shops?.map((shop) => ({
                id: shop.id,
                createdAt: shop.createdAt.toISOString(),
                shop: {
                    id: shop.shop.id,
                    name: shop.shop.name,
                    image: shop.shop.image,
                    verified: shop.shop.verified,
                },
            })),
            setups: data.setups?.map((setup) => ({
                id: setup.id,
                createdAt: setup.createdAt.toISOString(),
                updatedAt: setup.updatedAt?.toISOString(),
                name: setup.name,
                description: setup.description,
                items: setup.items?.map((item) => ({
                    id: item.item.id,
                    category: item.item.category,
                    source: item.item.source,
                    name: item.item.name,
                    image: item.item.image,
                    price: item.item.price,
                    likes: item.item.likes,
                    nsfw: item.item.nsfw,
                    shop: {
                        id: item.item.shop.id,
                        name: item.item.shop.name,
                        image: item.item.shop.image,
                        verified: item.item.shop.verified,
                    },
                    unsupported: item.unsupported,
                    shapekeys: item.shapekeys?.map((shapekey) => ({
                        name: shapekey.name,
                        value: shapekey.value,
                    })),
                })),
                images: setup.images,
                tags: setup.tags,
                coauthors: setup.coauthors,
                tools: setup.tools,
            })),
        }
    },
    {
        errorMessage: 'Failed to get user',
    }
)
