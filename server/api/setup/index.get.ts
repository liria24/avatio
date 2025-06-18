import database from '@@/database'
import { setups, setupTags } from '@@/database/schema'
import { eq, type SQL } from 'drizzle-orm'
import { z } from 'zod/v4'

const query = z.object({
    q: z.string().optional(),
    orderBy: z.enum(['createdAt', 'name']).optional().default('createdAt'),
    sort: z.enum(['asc', 'desc']).optional().default('desc'),
    userId: z.string().optional(),
    tag: z.union([z.string(), z.array(z.string())]).optional(),
    page: z.coerce.number().min(1).optional().default(1),
    limit: z.coerce.number().min(1).max(1000).optional().default(24),
})

export default defineApi<PaginationResponse<Setup[]>>(
    async () => {
        const { q, orderBy, sort, userId, tag, page, limit } =
            await validateQuery(query)

        const offset = (page - 1) * limit

        const data = await database.query.setups.findMany({
            extras: (table) => ({
                count: database
                    .$count(setups, eq(table.visibility, true))
                    .as('count'),
            }),
            limit,
            offset,
            where: (setups, { eq, and, ilike, exists, inArray }) => {
                const conditions: SQL[] = [eq(setups.visibility, true)]

                if (userId) conditions.push(eq(setups.userId, userId))

                if (q) conditions.push(ilike(setups.name, `%${q}%`))

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
                tools: {
                    columns: {
                        toolId: true,
                        note: true,
                    },
                },
            },
        })

        const result = data.map((setup) => ({
            id: setup.id,
            createdAt: setup.createdAt.toISOString(),
            updatedAt: setup.updatedAt.toISOString(),
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
            items: setup.items.map((item) => ({
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
                id: coauthor.user.id,
                createdAt: coauthor.user.createdAt.toISOString(),
                name: coauthor.user.name,
                image: coauthor.user.image,
                bio: coauthor.user.bio,
                links: coauthor.user.links,
                badges: coauthor.user.badges.map((badge) => ({
                    badge: badge.badge,
                    createdAt: badge.createdAt.toISOString(),
                })),
                shops: coauthor.user.shops.map((shop) => ({
                    id: shop.id,
                    createdAt: shop.createdAt.toISOString(),
                    shop: shop.shop,
                })),
                note: coauthor.note,
            })),
            tools: setup.tools,
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
