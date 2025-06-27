import database from '@@/database'
import { setups, user } from '@@/database/schema'
import { z } from 'zod/v4'

const params = z.object({
    id: z.union([z.string().transform((val) => Number(val)), z.number()]),
})

export default defineApi<Bookmark>(
    async (session) => {
        const { id } = await validateParams(params)

        const data = await database.query.bookmarks.findFirst({
            where: (bookmarks, { eq, or, and, exists, isNull }) =>
                and(
                    eq(bookmarks.id, id),
                    exists(
                        database
                            .select()
                            .from(setups)
                            .innerJoin(user, eq(setups.userId, user.id))
                            .where(
                                and(
                                    eq(setups.id, bookmarks.setupId),
                                    isNull(setups.hidAt),
                                    or(
                                        isNull(user.banned),
                                        eq(user.banned, false)
                                    )
                                )
                            )
                    )
                ),
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
                        hidAt: true,
                        hidReason: true,
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
                            where: (
                                coauthors,
                                { eq, or, and, exists, isNull }
                            ) =>
                                exists(
                                    database
                                        .select()
                                        .from(user)
                                        .where(
                                            and(
                                                eq(user.id, coauthors.userId),
                                                or(
                                                    eq(user.banned, false),
                                                    isNull(user.banned)
                                                )
                                            )
                                        )
                                ),
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
                hidAt: data.setup.hidAt?.toISOString() || null,
                hidReason: data.setup.hidReason,
                user: {
                    ...data.setup.user,
                    createdAt: data.setup.user.createdAt.toISOString(),
                    badges: data.setup.user.badges.map((badge) => ({
                        ...badge,
                        createdAt: badge.createdAt.toISOString(),
                    })),
                    shops: data.setup.user.shops.map((shop) => ({
                        ...shop,
                        createdAt: shop.createdAt.toISOString(),
                    })),
                },
                name: data.setup.name,
                description: data.setup.description,
                items: data.setup.items.map((item) => ({
                    ...item.item,
                    updatedAt: item.item.updatedAt.toISOString(),
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
            },
        }
    },
    {
        errorMessage: 'Failed to get bookmark',
        requireSession: true,
    }
)
