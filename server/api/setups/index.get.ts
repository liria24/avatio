import { setupItems, setups, setupTags, user } from '@@/database/schema'
import { and, eq, exists, ilike, inArray, isNull, or } from 'drizzle-orm'
import { z } from 'zod'

const query = z.object({
    q: z.string().optional(),
    orderBy: z.enum(['createdAt', 'name']).optional().default('createdAt'),
    sort: z.enum(['asc', 'desc']).optional().default('desc'),
    userId: z.string().optional(),
    itemId: z.union([z.string(), z.array(z.string())]).optional(),
    tag: z.union([z.string(), z.array(z.string())]).optional(),
    page: z.coerce.number().min(1).optional().default(1),
    limit: z.coerce.number().min(1).max(1000).optional().default(64),
})

export default defineApi<PaginationResponse<Setup[]>>(
    async () => {
        const { q, orderBy, sort, userId, itemId, tag, page, limit } =
            await validateQuery(query)

        const offset = (page - 1) * limit

        const data = await db.query.setups.findMany({
            extras: {
                count: db
                    .$count(
                        setups,
                        and(
                            ...[
                                isNull(setups.hidAt),
                                exists(
                                    db
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
                                ),
                                q ? ilike(setups.name, `%${q}%`) : undefined,
                                userId ? eq(setups.userId, userId) : undefined,
                                itemId
                                    ? exists(
                                          db
                                              .select()
                                              .from(setupItems)
                                              .where(
                                                  and(
                                                      eq(
                                                          setupItems.setupId,
                                                          setups.id
                                                      ),
                                                      inArray(
                                                          setupItems.itemId,
                                                          Array.isArray(itemId)
                                                              ? itemId
                                                              : [itemId]
                                                      )
                                                  )
                                              )
                                      )
                                    : undefined,
                                tag
                                    ? exists(
                                          db
                                              .select()
                                              .from(setupTags)
                                              .where(
                                                  and(
                                                      eq(
                                                          setupTags.setupId,
                                                          setups.id
                                                      ),
                                                      inArray(
                                                          setupTags.tag,
                                                          Array.isArray(tag)
                                                              ? tag
                                                              : [tag]
                                                      )
                                                  )
                                              )
                                      )
                                    : undefined,
                            ]
                        )
                    )
                    .as('count'),
            },
            limit,
            offset,
            where: {
                hidAt: { isNull: true },
                user: {
                    OR: [
                        { banned: { eq: false } },
                        { banned: { isNull: true } },
                    ],
                },
                name: q ? { ilike: `%${q}%` } : undefined,
                userId: userId ? { eq: userId } : undefined,
                items: {
                    itemId: itemId
                        ? { in: Array.isArray(itemId) ? itemId : [itemId] }
                        : undefined,
                },
                tags: tag
                    ? { tag: { in: Array.isArray(tag) ? tag : [tag] } }
                    : undefined,
            },
            orderBy: {
                [orderBy]: sort,
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
                            OR: [
                                { banned: { eq: false } },
                                { banned: { isNull: true } },
                            ],
                        },
                    },
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
        })

        const result = data.map((setup) => ({
            ...setup,
            items: setup.items
                .filter((item) => !item.item.outdated)
                .map((item) => item.item),
            tags: setup.tags.map((tag) => tag.tag),
            failedItemsCount: setup.items.filter((item) => item.item.outdated)
                .length,
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
    },
    {
        errorMessage: 'Failed to get setups',
    }
)
