import database from '@@/database'
import { user } from '@@/database/schema'
import { z } from 'zod/v4'

const params = z.object({
    id: z.union([z.string().transform((val) => Number(val)), z.number()]),
})

export default defineApi<Setup>(
    async ({ session }) => {
        const event = useEvent()
        const config = useRuntimeConfig(event)

        const { id } = await validateParams(params)

        const data = await database.query.setups.findFirst({
            where: (setups, { eq, and, exists, or, isNull }) =>
                and(
                    eq(setups.id, id),
                    exists(
                        database
                            .select()
                            .from(user)
                            .where(
                                and(
                                    eq(user.id, setups.userId),
                                    or(
                                        eq(user.banned, false),
                                        isNull(user.banned)
                                    )
                                )
                            )
                    )
                ),
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
                                niceName: true,
                                image: true,
                                price: true,
                                likes: true,
                                nsfw: true,
                                outdated: true,
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
                    where: (coauthors, { eq, or, and, exists, isNull }) =>
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
        })

        if (!data)
            throw createError({
                statusCode: 404,
                statusMessage: 'Setup not found',
            })

        if (
            data.hidAt &&
            session?.user.id !== data.user.id &&
            session?.user.role !== 'admin'
        )
            throw createError({
                statusCode: 404,
                statusMessage: 'Setup not found',
            })

        const items: SetupItem[] = []
        let failedItemsCount = 0

        const expiredItems = data.items.filter((item) => {
            const timeDifference =
                new Date().getTime() - new Date(item.item.updatedAt).getTime()
            return timeDifference >= 24 * 60 * 60 * 1000
        })

        const validItems = data.items.filter((item) => {
            const timeDifference =
                new Date().getTime() - new Date(item.item.updatedAt).getTime()
            return timeDifference < 24 * 60 * 60 * 1000
        })

        // 有効なアイテムを処理（outdatedなものは除外）
        for (const item of validItems) {
            if (item.item.outdated) {
                failedItemsCount++
                continue
            }
            items.push({
                ...item.item,
                unsupported: item.unsupported,
                note: item.note,
                shapekeys: item.shapekeys,
            })
        }

        // 期限切れのアイテムを並行して更新
        const expiredItemsPromises = expiredItems.map(async (item) => {
            try {
                const response = await $fetch<Item>(
                    `/api/items/${item.item.id}`,
                    {
                        headers: {
                            authorization: `Bearer ${config.adminKey}`,
                        },
                        query: {
                            platform: item.item.platform,
                        },
                    }
                )
                return {
                    success: true,
                    data: {
                        ...response,
                        unsupported: item.unsupported,
                        note: item.note,
                        shapekeys: item.shapekeys,
                    },
                }
            } catch (error) {
                console.error(`Failed to fetch item ${item.item.id}:`, error)
                return {
                    success: false,
                    data: null,
                }
            }
        })

        // 並行処理の結果を待機して処理
        const expiredItemsResults = await Promise.all(expiredItemsPromises)

        for (const result of expiredItemsResults) {
            if (result.success && result.data) {
                // 更新後もoutdatedの場合は除外
                if (result.data.outdated) {
                    failedItemsCount++
                    continue
                }
                items.push(result.data)
            } else {
                failedItemsCount++
            }
        }

        return {
            id: data.id,
            createdAt: data.createdAt.toISOString(),
            updatedAt: data.updatedAt.toISOString(),
            hidAt: data.hidAt?.toISOString() || null,
            hidReason: data.hidReason || null,
            user: {
                ...data.user,
                createdAt: data.user.createdAt.toISOString(),
                badges: data.user.badges.map((badge) => ({
                    ...badge,
                    createdAt: badge.createdAt.toISOString(),
                })),
                shops: data.user.shops.map((shop) => ({
                    ...shop,
                    createdAt: shop.createdAt.toISOString(),
                })),
            },
            name: data.name,
            description: data.description,
            items,
            images: data.images,
            tags: data.tags.map((tag) => tag.tag),
            coauthors: data.coauthors.map((coauthor) => ({
                ...coauthor,
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
            })),
            failedItemsCount,
        }
    },
    {
        errorMessage: 'Failed to get setups',
    }
)
