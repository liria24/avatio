import { z } from 'zod'

const params = z.object({
    id: z.string(),
})

export default sessionEventHandler<Setup>(async ({ event, session, db }) => {
    const { id } = await validateParams(params)

    const data = await db.query.setups.findFirst({
        where: {
            id: { eq: id },
            user: {
                OR: [{ banned: { eq: false } }, { banned: { isNull: true } }],
            },
        },
        columns: {
            id: true,
            userId: true,
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
                    followers: session
                        ? {
                              where: { userId: { eq: session.user.id } },
                              columns: { id: true },
                          }
                        : undefined,
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
                    objectKey: true,
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
                            followers: session
                                ? {
                                      where: { userId: { eq: session.user.id } },
                                      columns: { id: true },
                                  }
                                : undefined,
                        },
                    },
                },
            },
        },
    })

    if (!data) throw serverError.notFound()

    const canViewHidden =
        !data.hidAt || session?.user.role === 'admin' || session?.user.id === data.userId
    if (!canViewHidden) throw serverError.notFound()

    const items: SetupItem[] = []
    const revalidationTasks: Promise<unknown>[] = []
    let failedItemsCount = 0

    for (const setupItem of data.items) {
        if (setupItem.item.outdated) {
            failedItemsCount++
            continue
        }

        revalidationTasks.push(enqueueItemRevalidation(event, setupItem.item, 'setup-detail'))

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

    if (!session && data.public && !data.hidAt)
        applyPublicEdgeCache(event, [getSetupCacheTag(data.id)])

    return {
        ...data,
        user: {
            ...data.user,
            isFollowing: !!data.user.followers?.length,
            followers: undefined,
        },
        coauthors: data.coauthors.map((coauthor) => ({
            ...coauthor,
            user: {
                ...coauthor.user,
                isFollowing: !!coauthor.user.followers?.length,
                followers: undefined,
            },
        })),
        images: await withSetupImageUrls(data.images),
        items,
        tags: data.tags.map((tag) => tag.tag),
        failedItemsCount,
    }
})
