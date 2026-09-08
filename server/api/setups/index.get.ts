import { bookmarks } from '@@/database/schema'
import { sql } from 'drizzle-orm'
import { z } from 'zod'

const query = z.object({
    viewer: z.union([z.boolean(), z.stringbool()]).optional(),
    bookmarked: z.union([z.boolean(), z.stringbool()]).optional(),
    id: z.union([z.string(), z.array(z.string())]).optional(),
    q: z.string().optional(),
    orderBy: z.enum(['createdAt', 'name']).optional(),
    sort: z.enum(['asc', 'desc']).optional().default('desc'),
    username: z.string().optional(),
    itemId: z.union([z.string(), z.array(z.string())]).optional(),
    tag: z.union([z.string(), z.array(z.string())]).optional(),
    includePrivate: z.union([z.boolean(), z.stringbool()]).optional(),
    bookmarkedBy: z.string().optional(),
    following: z.union([z.boolean(), z.stringbool()]).optional(),
    page: z.coerce.number().min(1).optional().default(1),
    limit: z.coerce.number().min(1).max(API_LIMIT_MAX).optional().default(SETUPS_API_DEFAULT_LIMIT),
})

export default sessionEventHandler(async ({ event, session, db }) => {
    const {
        id,
        q,
        orderBy,
        sort,
        username,
        itemId,
        tag,
        bookmarkedBy: requestedBookmarkedBy,
        bookmarked,
        viewer,
        following,
        includePrivate,
        page,
        limit,
    } = await validateQuery(query)

    if ((following || bookmarked || viewer) && !session) throw serverError.unauthorized()

    const bookmarkedBy = requestedBookmarkedBy ?? (bookmarked ? session?.user.username : undefined)
    const personalized = !!(viewer || following || bookmarkedBy || includePrivate)
    if (personalized) applyNoStoreCache(event)

    const effectiveOrderBy = bookmarkedBy && !orderBy ? 'bookmarkCreatedAt' : orderBy || 'createdAt'
    const effectiveSort = sort

    const offset = (page - 1) * limit
    const bookmarkedUser = bookmarkedBy
        ? await db.query.users.findFirst({
              where: {
                  username: { eq: bookmarkedBy },
                  OR: [{ banned: { eq: false } }, { banned: { isNull: true } }],
              },
              columns: {
                  id: true,
              },
              with: {
                  settings: {
                      columns: {
                          publicBookmarks: true,
                      },
                  },
              },
          })
        : null

    if (
        bookmarkedBy &&
        (!bookmarkedUser ||
            (bookmarkedBy !== session?.user.username && !bookmarkedUser.settings?.publicBookmarks))
    )
        return {
            data: [],
            pagination: {
                page,
                limit,
                total: 0,
                totalPages: 0,
                hasNext: false,
                hasPrev: offset > 0,
            },
        }

    const shouldShowPrivate =
        (bookmarkedBy && bookmarkedBy === session?.user.username) ||
        (username && session?.user.username === username && includePrivate === true)

    const data = await db.query.setups.findMany({
        extras: {
            count: sql<number>`CAST(COUNT(*) OVER() AS INTEGER)`,
        },
        limit,
        offset,
        where: {
            hidAt: { isNull: true },
            OR:
                shouldShowPrivate && session
                    ? [{ public: { eq: true } }, { userId: { eq: session.user.id } }]
                    : [{ public: { eq: true } }],
            user: {
                OR: [{ banned: { eq: false } }, { banned: { isNull: true } }],
                username: username ? { eq: username } : undefined,
                NOT:
                    personalized && session
                        ? { mutees: { userId: { eq: session.user.id } } }
                        : undefined,
                followers: session && following ? { userId: { eq: session.user.id } } : undefined,
            },
            id: id ? { in: Array.isArray(id) ? id : [id] } : undefined,
            name: q ? { like: `%${q}%` } : undefined,
            entries: {
                itemId: itemId ? { in: Array.isArray(itemId) ? itemId : [itemId] } : undefined,
            },
            tags: tag ? { tag: { in: Array.isArray(tag) ? tag : [tag] } } : undefined,
            bookmarks: bookmarkedBy
                ? {
                      userId: { eq: bookmarkedUser!.id },
                  }
                : undefined,
        },
        orderBy:
            effectiveOrderBy === 'bookmarkCreatedAt'
                ? (table) => sql`(
                    SELECT MAX(${bookmarks.createdAt})
                    FROM ${bookmarks}
                    WHERE ${bookmarks.setupId} = ${table.id}
                    AND ${bookmarks.userId} = ${bookmarkedUser!.id}
                ) ${effectiveSort === 'asc' ? sql`ASC` : sql`DESC`}`
                : {
                      [effectiveOrderBy]: effectiveSort,
                  },
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
                },
            },
            entries: {
                with: {
                    item: { with: catalogItemRelations },
                    shapekeys: { columns: { name: true, value: true } },
                },
            },
            images: {
                limit: 1,
                columns: {
                    objectKey: true,
                    themeColors: true,
                    width: true,
                    height: true,
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
                    },
                },
            },
        },
    })

    const setupData = await Promise.all(
        data.map(async (setup) => ({
            ...setup,
            images: await withSetupImageUrls(setup.images),
            entries: setup.entries.map(projectSetupEntry),
            failedItemsCount:
                setup.entries.filter(
                    (entry) =>
                        entry.item.sources.find((source) => source.primary)?.availability !==
                        'available',
                ).length || undefined,
            count: undefined,
        })),
    )

    const result = {
        data: setupData,
        pagination: {
            page,
            limit,
            total: data[0]?.count || 0,
            totalPages: Math.ceil((data[0]?.count || 0) / limit),
            hasNext: offset + limit < (data[0]?.count || 0),
            hasPrev: offset > 0,
        },
    }

    if (!personalized) applyPublicEdgeCache(event, [EDGE_CACHE_TAGS.setups])

    return result
})
