import database from '@@/database'
import { z } from 'zod/v4'

const params = z.object({
    id: z.string(),
})

export default defineApi<
    UserWithSetups,
    {
        errorMessage: 'Failed to get user'
    }
>(async () => {
    const { id } = await validateParams(params)

    const data = await database.query.user.findFirst({
        where: (user, { eq, or, and, isNull }) =>
            and(
                eq(user.id, id),
                or(eq(user.banned, false), isNull(user.banned))
            ),
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
            setups: {
                where: (setup, { isNull }) => isNull(setup.hidAt),
                orderBy: (setup, { desc }) => desc(setup.createdAt),
                columns: {
                    id: true,
                    createdAt: true,
                    updatedAt: true,
                    name: true,
                    description: true,
                    hidAt: true,
                    hidReason: true,
                },
                with: {
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
                                    niceName: true,
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
            shop: shop.shop,
        })),
        setups: data.setups?.map((setup) => ({
            id: setup.id,
            createdAt: setup.createdAt.toISOString(),
            updatedAt: setup.updatedAt?.toISOString(),
            hidAt: setup.hidAt?.toISOString() || null,
            hidReason: setup.hidReason,
            user: {
                ...data,
                createdAt: data.createdAt.toISOString(),
                badges: data.badges?.map((badge) => ({
                    ...badge,
                    createdAt: badge.createdAt.toISOString(),
                })),
                shops: data.shops?.map((shop) => ({
                    ...shop,
                    createdAt: shop.createdAt.toISOString(),
                })),
            },
            name: setup.name,
            description: setup.description,
            items: setup.items?.map((item) => ({
                ...item.item,
                unsupported: item.unsupported,
                note: item.note,
                shapekeys: item.shapekeys?.map((shapekey) => ({
                    name: shapekey.name,
                    value: shapekey.value,
                })),
            })),
            images: setup.images,
            tags: setup.tags.map((tag) => tag.tag),
            coauthors: setup.coauthors.map((coauthor) => ({
                user: {
                    ...coauthor.user,
                    createdAt: coauthor.user.createdAt.toISOString(),
                    badges: coauthor.user.badges.map((badge) => ({
                        ...badge,
                        createdAt: badge.createdAt.toISOString(),
                    })),
                    shops: coauthor.user.shops.map((shop) => ({
                        ...shop,
                        createdAt: shop.createdAt.toISOString(),
                    })),
                },
                note: coauthor.note,
            })),
        })),
    }
})
