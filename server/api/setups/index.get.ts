import { bookmarks } from '@@/database/schema'
import { sql } from 'drizzle-orm'
import { z } from 'zod'

const query = z.object({
    q: z.string().optional(),
    orderBy: z.enum(['createdAt', 'name']).optional(),
    sort: z.enum(['asc', 'desc']).optional().default('desc'),
    username: z.string().optional(),
    itemId: z.union([z.string(), z.array(z.string())]).optional(),
    tag: z.union([z.string(), z.array(z.string())]).optional(),
    bookmarked: z.union([z.boolean(), z.stringbool()]).optional(),
    page: z.coerce.number().min(1).optional().default(1),
    limit: z.coerce.number().min(1).max(API_LIMIT_MAX).optional().default(SETUPS_API_DEFAULT_LIMIT),
})

export default sessionEventHandler<PaginationResponse<Setup[]>>(async ({ session }) => {
    const { q, orderBy, sort, username, itemId, tag, bookmarked, page, limit } =
        await validateQuery(query)

    if (bookmarked && !session)
        throw createError({
            status: 401,
            statusText: 'Unauthorized',
        })

    // bookmarked === true かつ orderByが未指定の場合、bookmarks.createdAtでソート
    const effectiveOrderBy = bookmarked && !orderBy ? 'bookmarkCreatedAt' : orderBy || 'createdAt'
    const effectiveSort = sort

    const offset = (page - 1) * limit

    const data = await db.query.setups.findMany({
        extras: {
            count: sql<number>`CAST(COUNT(*) OVER() AS INTEGER)`,
        },
        limit,
        offset,
        where: {
            hidAt: { isNull: true },
            user: {
                OR: [{ banned: { eq: false } }, { banned: { isNull: true } }],
                username: username ? { eq: username } : undefined,
            },
            name: q ? { ilike: `%${q}%` } : undefined,
            items: {
                itemId: itemId ? { in: Array.isArray(itemId) ? itemId : [itemId] } : undefined,
            },
            tags: tag ? { tag: { in: Array.isArray(tag) ? tag : [tag] } } : undefined,
            bookmarks: bookmarked && session ? { userId: { eq: session.user.id } } : undefined,
        },
        orderBy:
            effectiveOrderBy === 'bookmarkCreatedAt'
                ? (table) => sql`(
                    SELECT ${bookmarks.createdAt}
                    FROM ${bookmarks}
                    WHERE ${bookmarks.setupId} = ${table.id}
                    AND ${bookmarks.userId} = ${session!.user.id}
                ) ${effectiveSort === 'asc' ? sql`ASC` : sql`DESC`}`
                : {
                      [effectiveOrderBy]: effectiveSort,
                  },
        columns: {
            id: true,
            createdAt: true,
            updatedAt: true,
            userId: true,
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

    const result = data.map((setup) => ({
        ...setup,
        items: setup.items.filter((item) => !item.item.outdated).map((item) => item.item),
        tags: setup.tags.map((tag) => tag.tag),
        failedItemsCount: setup.items.filter((item) => item.item.outdated).length,
        count: undefined,
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
