import { z } from 'zod'

const log = logger('/api/setups/[id]:GET')

const params = z.object({
    id: z.string(),
})

export default sessionEventHandler<Setup>(async ({ session }) => {
    const { id } = await validateParams(params)

    type Args = { id: Setup['id']; session: Session | undefined }
    const getSetup = defineCachedFunction(
        async ({ id, session }: Args) => {
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

            if (
                !data ||
                (data.hidAt &&
                    session?.user.username !== data.user.username &&
                    session?.user.role !== 'admin')
            )
                throw serverError.notFound()

            const results = await Promise.all(
                data.items.map(async (item) => {
                    if (item.item.outdated) return null
                    try {
                        const response = await getItem(item.item.platform, item.item.id)
                        if (response.outdated) return null
                        return {
                            ...response,
                            category: item.category || response.category,
                            unsupported: item.unsupported,
                            note: item.note,
                            shapekeys: item.shapekeys,
                        }
                    } catch (error) {
                        log.error(`Failed to fetch item ${item.item.id}:`, error)
                        return null
                    }
                }),
            )

            const items: SetupItem[] = []
            let failedItemsCount = 0

            for (const result of results)
                if (result) items.push(result)
                else failedItemsCount++

            return {
                ...data,
                user: {
                    ...data.user,
                    isFollowing: !!data.user.followers.length,
                    followers: undefined,
                },
                coauthors: data.coauthors.map((coauthor) => ({
                    ...coauthor,
                    user: {
                        ...coauthor.user,
                        isFollowing: !!coauthor.user.followers.length,
                        followers: undefined,
                    },
                })),
                items,
                tags: data.tags.map((tag) => tag.tag),
                failedItemsCount,
            }
        },
        {
            maxAge: SETUP_CACHE_TTL,
            name: 'setup',
            getKey: ({ id, session }: Args) => `${id}${session ? `:${session.user.id}` : ''}`,
            swr: false,
        },
    )

    return await getSetup({ id, session: session || undefined })
})
