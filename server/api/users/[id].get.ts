import database from '@@/database'
import { user } from '@@/database/schema'
import { z } from 'zod/v4'

const params = z.object({
    id: z.string(),
})

export default defineApi<UserWithSetups>(
    async () => {
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
                            where: (table, { eq }) =>
                                eq(table.category, 'avatar'),
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
                                },
                            },
                        },
                        images: {
                            columns: {
                                url: true,
                                width: true,
                                height: true,
                                themeColors: true,
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
                items: setup.items.map((item) => ({
                    ...item.item,
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
                    },
                    note: coauthor.note,
                })),
            })),
        }
    },
    {
        errorMessage: 'Failed to get user',
    }
)
