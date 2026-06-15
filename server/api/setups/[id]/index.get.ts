import { z } from 'zod'

const params = z.object({
    id: z.string(),
})

export default sessionEventHandler<Setup>(async ({ event, session, db }) => {
    const { id } = await validateParams(params)

    const cacheVisibility = await db.query.setups.findFirst({
        where: {
            id: { eq: id },
            user: {
                OR: [{ banned: { eq: false } }, { banned: { isNull: true } }],
            },
        },
        columns: {
            id: true,
            userId: true,
            hidAt: true,
        },
    })
    if (!cacheVisibility) throw serverError.notFound()

    const cacheKey = getSetupCacheKey(cacheVisibility, session)
    if (!cacheKey) throw serverError.notFound()

    type Args = { id: Setup['id']; cacheKey: string }
    const getSetup = defineCachedFunction(
        async ({ id }: Args) => {
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
                    public: true,
                    name: true,
                    description: true,
                    hidAt: true,
                    hidReason: true,
                },
                with: {
                    user: {
                        columns: {
                            id: true,
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
                                    id: true,
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
                                },
                            },
                        },
                    },
                },
            })

            if (!data) throw serverError.notFound()

            const items: SetupItem[] = []
            const revalidationTasks: Promise<unknown>[] = []
            let failedItemsCount = 0

            for (const setupItem of data.items) {
                if (setupItem.item.outdated) {
                    failedItemsCount++
                    continue
                }

                revalidationTasks.push(
                    enqueueItemRevalidation(event, setupItem.item, 'setup-detail'),
                )

                items.push({
                    id: setupItem.item.id,
                    platform: setupItem.item.platform,
                    category: setupItem.category || setupItem.item.category,
                    name: setupItem.item.name,
                    niceName: setupItem.item.niceName,
                    image: setupItem.item.image,
                    price: setupItem.item.price,
                    likes: setupItem.item.likes,
                    nsfw: setupItem.item.nsfw,
                    outdated: setupItem.item.outdated,
                    shop: setupItem.item.shop,
                    unsupported: setupItem.unsupported,
                    note: setupItem.note,
                    shapekeys: setupItem.shapekeys,
                })
            }

            if (revalidationTasks.length) runAfterResponse(Promise.all(revalidationTasks))

            return {
                ...data,
                items,
                tags: data.tags.map((tag) => tag.tag),
                failedItemsCount,
            }
        },
        {
            maxAge: SETUP_CACHE_TTL,
            name: 'setup',
            getKey: ({ cacheKey }: Args) => cacheKey,
            swr: false,
        },
    )

    return await getSetup({ id, cacheKey })
})
