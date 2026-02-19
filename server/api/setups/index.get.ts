import { bookmarks } from '@@/database/schema'
import { sql } from 'drizzle-orm'
import { z } from 'zod'

const query = z.object({
    id: z.union([z.string(), z.array(z.string())]).optional(),
    q: z.string().optional(),
    orderBy: z.enum(['createdAt', 'name']).optional(),
    sort: z.enum(['asc', 'desc']).optional().default('desc'),
    username: z.string().optional(),
    itemId: z.union([z.string(), z.array(z.string())]).optional(),
    tag: z.union([z.string(), z.array(z.string())]).optional(),
    bookmarkedBy: z.string().optional(),
    following: z.union([z.boolean(), z.stringbool()]).optional(),
    page: z.coerce.number().min(1).optional().default(1),
    limit: z.coerce.number().min(1).max(API_LIMIT_MAX).optional().default(SETUPS_API_DEFAULT_LIMIT),
})

export default sessionEventHandler(async ({ session }) => {
    const { id, q, orderBy, sort, username, itemId, tag, bookmarkedBy, following, page, limit } =
        await validateQuery(query)

    const effectiveOrderBy = bookmarkedBy && !orderBy ? 'bookmarkCreatedAt' : orderBy || 'createdAt'
    const effectiveSort = sort

    const offset = (page - 1) * limit

    const shouldShowPrivate =
        (bookmarkedBy && bookmarkedBy === session?.user.username) ||
        (username && username === session?.user.username)

    const data = await db.query.setups.findMany({
        extras: {
            count: sql<number>`CAST(COUNT(*) OVER() AS INTEGER)`,
        },
        limit,
        offset,
        where: {
            hidAt: { isNull: true },
            public: shouldShowPrivate ? undefined : { eq: true },
            user: {
                OR: [{ banned: { eq: false } }, { banned: { isNull: true } }],
                username: username ? { eq: username } : undefined,
                NOT: session ? { mutees: { userId: { eq: session.user.id } } } : undefined,
                followers: session && following ? { userId: { eq: session.user.id } } : undefined,
            },
            id: id ? { in: Array.isArray(id) ? id : [id] } : undefined,
            name: q ? { ilike: `%${q}%` } : undefined,
            items: {
                itemId: itemId ? { in: Array.isArray(itemId) ? itemId : [itemId] } : undefined,
            },
            tags: tag ? { tag: { in: Array.isArray(tag) ? tag : [tag] } } : undefined,
            bookmarks: bookmarkedBy
                ? {
                      user: {
                          username: { eq: bookmarkedBy },
                          settings: {
                              publicBookmarks:
                                  bookmarkedBy !== session?.user.username
                                      ? { eq: true }
                                      : undefined,
                          },
                      },
                  }
                : undefined,
        },
        orderBy:
            effectiveOrderBy === 'bookmarkCreatedAt'
                ? (table) => sql`(
                    SELECT ${bookmarks.createdAt}
                    FROM ${bookmarks}
                    WHERE ${bookmarks.setupId} = ${table.id}
                    AND ${bookmarks.userId} = ${bookmarkedBy!}
                ) ${effectiveSort === 'asc' ? sql`ASC` : sql`DESC`}`
                : { [effectiveOrderBy]: effectiveSort },
        columns: {
            id: true,
            createdAt: true,
            updatedAt: true,
            public: true,
            name: true,
            hidAt: true,
        },
        with: {
            user: {
                columns: {
                    username: true,
                    name: true,
                    image: true,
                },
                with: {
                    badges: {
                        columns: {
                            badge: true,
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
                where: {
                    category: { eq: 'avatar' },
                },
                with: {
                    item: {
                        columns: {
                            id: true,
                            updatedAt: true,
                            platform: true,
                            name: true,
                            niceName: true,
                            image: true,
                            nsfw: true,
                            outdated: true,
                        },
                    },
                },
            },
            images: {
                limit: 1,
                columns: {
                    url: true,
                    themeColors: true,
                },
            },
            coauthors: {
                where: {
                    user: {
                        OR: [{ banned: { eq: false } }, { banned: { isNull: true } }],
                    },
                },
                columns: {
                    // note: true,
                },
                with: {
                    user: {
                        columns: {
                            username: true,
                            name: true,
                            image: true,
                        },
                        with: {
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

    const result = data.map((setup) => ({
        ...setup,
        user: {
            ...setup.user,
            isFollowing: !!setup.user.followers?.length,
            followers: undefined,
        },
        coauthors: setup.coauthors.map((coauthor) => ({
            ...coauthor,
            user: {
                ...coauthor.user,
                isFollowing: !!coauthor.user.followers?.length,
                followers: undefined,
            },
        })),
        items: setup.items
            .filter((item) => !item.item.outdated)
            .map((item) => ({
                ...item.item,
                outdated: undefined,
            })),
        failedItemsCount: setup.items.filter((item) => item.item.outdated).length || undefined,
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
