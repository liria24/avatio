import { sql } from 'drizzle-orm'
import { z } from 'zod'

const query = z.object({
    q: z.string().optional(),
    orderBy: z.enum(['createdAt', 'name']).optional().default('createdAt'),
    sort: z.enum(['asc', 'desc']).optional().default('desc'),
    userId: z.string().optional(),
    setupId: z
        .union([
            z.string().transform((val) => Number(val)),
            z.number(),
            z.array(z.string().transform((val) => Number(val))),
            z.array(z.number()),
        ])
        .optional(),
    tag: z.union([z.string(), z.array(z.string())]).optional(),
    page: z.coerce.number().min(1).optional().default(1),
    limit: z.coerce.number().min(1).max(1000).optional().default(24),
})

export default authedSessionEventHandler<PaginationResponse<Bookmark[]>>(async ({ session }) => {
    const { q, orderBy, sort, userId, setupId, tag, page, limit } = await validateQuery(query)

    const offset = (page - 1) * limit

    const data = await db.query.bookmarks.findMany({
        extras: {
            count: sql<number>`CAST(COUNT(*) OVER() AS INTEGER)`,
        },
        limit,
        offset,
        where: {
            user: {
                AND: [
                    { id: { eq: session!.user.id } },
                    {
                        OR: [{ banned: { eq: false } }, { banned: { isNull: true } }],
                    },
                ],
            },
            setup: {
                hidAt: { isNull: true },
                id: setupId ? { in: Array.isArray(setupId) ? setupId : [setupId] } : undefined,
                userId: userId ? { eq: userId } : undefined,
                name: q ? { ilike: `%${q}%` } : undefined,
                tags: tag ? { tag: { in: Array.isArray(tag) ? tag : [tag] } } : undefined,
            },
        },
        orderBy: {
            [orderBy]: sort,
        },
        columns: {
            id: true,
            createdAt: true,
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
                        where: {
                            category: { eq: 'avatar' },
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
                                },
                            },
                        },
                    },
                },
            },
        },
    })

    const result = data.map((bookmark) => ({
        ...bookmark,
        setup: {
            ...bookmark.setup,
            items: bookmark.setup.items.map((item) => item.item),
            tags: bookmark.setup.tags.map((tag) => tag.tag),
        },
    }))

    return {
        data: result,
        pagination: {
            page,
            limit,
            total: data[0]?.count || 0,
            totalPages: Math.ceil((data[0]?.count || 0) / limit),
            hasNext: offset + limit < (data[0]?.count || 0),
            hasPrev: offset > 0,
        },
    }
})
