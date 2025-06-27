import database from '@@/database'
import { items, setupItems, setups } from '@@/database/schema'
import { eq, type SQL } from 'drizzle-orm'
import { z } from 'zod/v4'

const query = z.object({
    q: z.string().optional(),
    orderBy: z.enum(['createdAt', 'name']).optional().default('createdAt'),
    sort: z.enum(['asc', 'desc']).optional().default('desc'),
    itemId: z
        .union([z.string(), z.array(z.string())])
        .transform((val) => (Array.isArray(val) ? val : [val]))
        .optional(),
    category: z
        .union([itemCategorySchema, itemCategorySchema.array()])
        .transform((val) => (Array.isArray(val) ? val : [val]))
        .optional(),
    page: z.coerce.number().min(1).optional().default(1),
    limit: z.coerce.number().min(1).max(1000).optional().default(24),
})

export default defineApi<PaginationResponse<Item[]>>(
    async () => {
        const { q, orderBy, sort, itemId, page, limit } =
            await validateQuery(query)

        const offset = (page - 1) * limit

        const data = await database.query.items.findMany({
            extras: (table) => ({
                count: database
                    .$count(items, eq(table.outdated, false))
                    .as('count'),
            }),
            limit,
            offset,
            where: (items, { eq, and, ilike, exists, inArray }) => {
                const conditions: SQL[] = [eq(items.outdated, false)]

                if (q) conditions.push(ilike(items.name, `%${q}%`))

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
        })

        const result = data.map((setup) => ({
            id: setup.id,
            createdAt: setup.createdAt.toISOString(),
            updatedAt: setup.updatedAt.toISOString(),
            platform: setup.platform,
            category: setup.category,
            name: setup.name,
            image: setup.image,
            price: setup.price,
            likes: setup.likes,
            nsfw: setup.nsfw,
            shop: setup.shop,
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
        errorMessage: 'Failed to get items.',
    }
)
