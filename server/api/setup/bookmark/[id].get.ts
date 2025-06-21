import database from '@@/database'
import { z } from 'zod/v4'

const params = z.object({
    id: z.union([z.string().transform((val) => Number(val)), z.number()]),
})

export default defineApi<Bookmark>(
    async (session) => {
        const { id } = await validateParams(params)

        const data = await database.query.bookmarks.findFirst({
            where: (bookmarks, { eq }) => eq(bookmarks.id, id),
            columns: {
                id: true,
                createdAt: true,
                userId: true,
            },
            with: {
                setup: {
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
                                                platform: true,
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
                                note: true,
                            },
                            with: {
                                item: {
                                    columns: {
                                        id: true,
                                        updatedAt: true,
                                        platform: true,
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
                                                platform: true,
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
                                note: true,
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
                                                        platform: true,
                                                        name: true,
                                                        image: true,
                                                        verified: true,
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        tools: {
                            columns: {
                                toolSlug: true,
                                note: true,
                            },
                        },
                    },
                },
            },
        })

        if (!data || data.userId !== session!.user.id)
            throw createError({
                statusCode: 404,
                message: 'Bookmark not found',
            })

        return {
            createdAt: data.createdAt.toISOString(),
            setup: {
                id: data.setup.id,
                createdAt: data.setup.createdAt.toISOString(),
                updatedAt: data.setup.updatedAt.toISOString(),
                user: {
                    id: data.setup.user.id,
                    createdAt: data.setup.user.createdAt.toISOString(),
                    name: data.setup.user.name,
                    image: data.setup.user.image,
                    bio: data.setup.user.bio,
                    links: data.setup.user.links,
                    badges: data.setup.user.badges.map((badge) => ({
                        badge: badge.badge,
                        createdAt: badge.createdAt.toISOString(),
                    })),
                    shops: data.setup.user.shops.map((shop) => ({
                        id: shop.id,
                        createdAt: shop.createdAt.toISOString(),
                        shop: shop.shop,
                    })),
                },
                name: data.setup.name,
                description: data.setup.description,
                items: data.setup.items.map((item) => ({
                    id: item.item.id,
                    updatedAt: item.item.updatedAt.toISOString(),
                    platform: item.item.platform,
                    category: item.item.category,
                    name: item.item.name,
                    image: item.item.image,
                    price: item.item.price,
                    likes: item.item.likes,
                    nsfw: item.item.nsfw,
                    shop: item.item.shop,
                    unsupported: item.unsupported,
                    shapekeys: item.shapekeys.map((shapekey) => ({
                        name: shapekey.name,
                        value: shapekey.value,
                    })),
                    note: item.note,
                })),
                images: data.setup.images,
                tags: data.setup.tags.map((tag) => tag.tag),
                coauthors: data.setup.coauthors.map((coauthor) => ({
                    id: coauthor.user.id,
                    createdAt: coauthor.user.createdAt.toISOString(),
                    name: coauthor.user.name,
                    image: coauthor.user.image,
                    bio: coauthor.user.bio,
                    links: coauthor.user.links,
                    badges: coauthor.user.badges.map((badge) => ({
                        badge: badge.badge,
                        createdAt: badge.createdAt.toISOString(),
                    })),
                    shops: coauthor.user.shops.map((shop) => ({
                        id: shop.id,
                        createdAt: shop.createdAt.toISOString(),
                        shop: shop.shop,
                    })),
                    note: coauthor.note,
                })),
                tools: data.setup.tools,
            },
        }
    },
    {
        errorMessage: 'Failed to get bookmark',
        requireSession: true,
        ratelimit: true,
    }
)
