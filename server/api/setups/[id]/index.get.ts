import { z } from 'zod'

const params = z.object({
    id: z.union([z.string().transform((val) => Number(val)), z.number()]),
})

const getSetup = defineCachedFunction(
    async (id: number, session: Session | undefined) => {
        const data = await db.query.setups.findFirst({
            where: {
                id: { eq: id },
                user: {
                    OR: [{ banned: { eq: false } }, { banned: { isNull: true } }],
                },
            },
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
                        username: true,
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
                        category: true,
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
                    where: {
                        user: {
                            OR: [{ banned: { eq: false } }, { banned: { isNull: true } }],
                        },
                    },
                    columns: {
                        note: true,
                    },
                    with: {
                        user: {
                            columns: {
                                username: true,
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
            session?.user.username !== data.user.username &&
            session?.user.role !== 'admin'
        )
            throw createError({
                statusCode: 404,
                statusMessage: 'Setup not found',
            })

        const items: SetupItem[] = []
        let failedItemsCount = 0

        const { forceUpdateItem } = await getEdgeConfig()

        const expiredFilter = (date: string | Date) => {
            if (forceUpdateItem) return true
            return new Date().getTime() - new Date(date).getTime() >= 24 * 60 * 60 * 1000
        }

        const expiredItems = data.items.filter((item) => expiredFilter(item.item.updatedAt))

        const validItems = data.items.filter((item) => !expiredFilter(item.item.updatedAt))

        // 有効なアイテムを処理（outdatedなものは除外）
        for (const item of validItems) {
            if (item.item.outdated) {
                failedItemsCount++
                continue
            }

            if (item.item.platform === 'github') {
                const data = await getGithubItem(item.item.id)
                if (!data) continue
                items.push({
                    ...data,
                    niceName: item.item.niceName,
                    category: item.category || data.category,
                    unsupported: item.unsupported,
                    note: item.note,
                    shapekeys: item.shapekeys,
                })
                continue
            }

            items.push({
                ...item.item,
                category: item.category || item.item.category,
                unsupported: item.unsupported,
                note: item.note,
                shapekeys: item.shapekeys,
            })
        }

        // 期限切れのアイテムを並行して更新
        const expiredItemsPromises = expiredItems.map(async (item) => {
            try {
                const response = await $fetch<Item>(
                    `/api/items/${transformItemId(item.item.id).encode()}`,
                    { query: { platform: item.item.platform } }
                )
                return {
                    success: true,
                    data: {
                        ...response,
                        unsupported: item.unsupported,
                        note: item.note,
                        shapekeys: item.shapekeys,
                        category: item.category || response.category,
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
            ...data,
            items,
            tags: data.tags.map((tag) => tag.tag),
            failedItemsCount,
        }
    },
    {
        maxAge: 60 * 60, // 1 hour
        name: 'setup',
        getKey: (id: number, session: Session | undefined) =>
            `${id}${session ? `:${session.user.id}` : ''}`,
        swr: false,
    }
)

export default sessionEventHandler<Setup>(async ({ session }) => {
    const { id } = await validateParams(params)

    return await getSetup(id, session || undefined)
})
