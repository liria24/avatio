import database from '@@/database'
import { setupItems, setups, setupTags, user } from '@@/database/schema'
import { isNull, type SQL } from 'drizzle-orm'
import { z } from 'zod/v4'

const query = z.object({
    q: z.string().optional(),
    orderBy: z.enum(['createdAt', 'name']).optional().default('createdAt'),
    sort: z.enum(['asc', 'desc']).optional().default('desc'),
    userId: z.string().optional(),
    itemId: z.union([z.string(), z.array(z.string())]).optional(),
    tag: z.union([z.string(), z.array(z.string())]).optional(),
    page: z.coerce.number().min(1).optional().default(1),
    limit: z.coerce.number().min(1).max(1000).optional().default(24),
})

export default defineApi<PaginationResponse<Setup[]>>(
    async () => {
        const { q, orderBy, sort, userId, itemId, tag, page, limit } =
            await validateQuery(query)

        const offset = (page - 1) * limit

        const data = await database.query.setups.findMany({
            extras: (table) => ({
                count: database.$count(setups, isNull(table.hidAt)).as('count'),
            }),
            limit,
            offset,
            where: (
                setups,
                { eq, or, and, ilike, exists, inArray, isNull }
            ) => {
                const conditions: SQL[] = [
                    isNull(setups.hidAt),
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
                    ),
                ]

                if (q) conditions.push(ilike(setups.name, `%${q}%`))

                if (userId) conditions.push(eq(setups.userId, userId))

                if (itemId)
                    conditions.push(
                        exists(
                            database
                                .select()
                                .from(setupItems)
                                .where(
                                    and(
                                        eq(setupItems.setupId, setups.id),
                                        inArray(
                                            setupItems.itemId,
                                            Array.isArray(itemId)
                                                ? itemId
                                                : [itemId]
                                        )
                                    )
                                )
                        )
                    )

                if (tag)
                    conditions.push(
                        exists(
                            database
                                .select()
                                .from(setupTags)
                                .where(
                                    and(
                                        eq(setupTags.setupId, setups.id),
                                        inArray(
                                            setupTags.tag,
                                            Array.isArray(tag) ? tag : [tag]
                                        )
                                    )
                                )
                        )
                    )

                return and(...conditions)
            },
            orderBy: (products, { asc, desc }) => {
                const sortFn = sort === 'desc' ? desc : asc
                switch (orderBy) {
                    case 'createdAt':
                        return sortFn(products.createdAt)
                    case 'name':
                        return sortFn(products.name)
                    default:
                        return sortFn(products.createdAt)
                }
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

        const result = data.map((setup) => ({
            id: setup.id,
            createdAt: setup.createdAt.toISOString(),
            updatedAt: setup.updatedAt.toISOString(),
            hidAt: setup.hidAt?.toISOString() || null,
            hidReason: setup.hidReason,
            user: {
                id: setup.user.id,
                createdAt: setup.user.createdAt.toISOString(),
                name: setup.user.name,
                image: setup.user.image,
                bio: setup.user.bio,
                links: setup.user.links,
                badges: setup.user.badges.map((badge) => ({
                    badge: badge.badge,
                    createdAt: badge.createdAt.toISOString(),
                })),
                shops: setup.user.shops.map((shop) => ({
                    id: shop.id,
                    createdAt: shop.createdAt.toISOString(),
                    shop: shop.shop,
                })),
            },
            name: setup.name,
            description: setup.description,
            items: setup.items
                .filter((item) => !item.item.outdated)
                .map((item) => ({
                    id: item.item.id,
                    updatedAt: item.item.updatedAt.toISOString(),
                    platform: item.item.platform,
                    category: item.item.category,
                    name: item.item.name,
                    image: item.item.image,
                    price: item.item.price,
                    likes: item.item.likes,
                    nsfw: item.item.nsfw,
                    shop: item.item.shop,
                    unsupported: item.unsupported,
                    shapekeys: item.shapekeys.map((shapekey) => ({
                        name: shapekey.name,
                        value: shapekey.value,
                    })),
                    note: item.note,
                })),
            images: setup.images,
            tags: setup.tags.map((tag) => tag.tag),
            coauthors: setup.coauthors.map((coauthor) => ({
                user: {
                    ...coauthor.user,
                    createdAt: coauthor.user.createdAt.toISOString(),
                    shops: coauthor.user.shops.map((shop) => ({
                        ...shop,
                        createdAt: shop.createdAt.toISOString(),
                    })),
                    badges: coauthor.user.badges.map((badge) => ({
                        ...badge,
                        createdAt: badge.createdAt.toISOString(),
                    })),
                },
                note: coauthor.note,
            })),
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
