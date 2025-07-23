import database from '@@/database'
import { bookmarks, setupTags, setups, user } from '@@/database/schema'
import type { SQL } from 'drizzle-orm'
import { eq } from 'drizzle-orm'
import { z } from 'zod/v4'

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

export default defineApi<PaginationResponse<Bookmark[]>>(
    async ({ session }) => {
        const { q, orderBy, sort, userId, setupId, tag, page, limit } =
            await validateQuery(query)

        const offset = (page - 1) * limit

        const data = await database.query.bookmarks.findMany({
            extras: (table) => ({
                count: database
                    .$count(bookmarks, eq(table.userId, session!.user.id))
                    .as('count'),
            }),
            limit,
            offset,
            where: (
                bookmarks,
                { eq, or, and, ilike, exists, inArray, isNull }
            ) => {
                const conditions: SQL[] = [
                    eq(bookmarks.userId, session!.user.id),
                    exists(
                        database
                            .select()
                            .from(setups)
                            .innerJoin(user, eq(setups.userId, user.id))
                            .where(
                                and(
                                    eq(setups.id, bookmarks.setupId),
                                    isNull(setups.hidAt),
                                    or(
                                        isNull(user.banned),
                                        eq(user.banned, false)
                                    )
                                )
                            )
                    ),
                ]

                if (userId)
                    conditions.push(
                        exists(
                            database
                                .select()
                                .from(setups)
                                .where(
                                    and(
                                        eq(setups.id, bookmarks.setupId),
                                        eq(setups.userId, userId)
                                    )
                                )
                        )
                    )

                if (setupId) {
                    const setupIds = Array.isArray(setupId)
                        ? setupId.map((id) => Number(id))
                        : [Number(setupId)]
                    conditions.push(inArray(bookmarks.setupId, setupIds))
                }

                if (q)
                    conditions.push(
                        exists(
                            database
                                .select()
                                .from(setups)
                                .where(
                                    and(
                                        eq(setups.id, bookmarks.setupId),
                                        ilike(setups.name, `%${q}%`)
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
                                        eq(
                                            setupTags.setupId,
                                            bookmarks.setupId
                                        ),
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
            orderBy: (bookmarks, { asc, desc }) => {
                const sortFn = sort === 'desc' ? desc : asc
                switch (orderBy) {
                    case 'createdAt':
                        return sortFn(bookmarks.createdAt)
                    case 'name':
                        return sortFn(bookmarks.createdAt)
                    default:
                        return sortFn(bookmarks.createdAt)
                }
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
                            where: (table, { eq }) =>
                                eq(table.category, 'avatar'),
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
                            where: (
                                coauthors,
                                { eq, or, and, exists, isNull }
                            ) =>
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
                                    },
                                },
                            },
                        },
                    },
                },
            },
        })

        const result = data.map((bookmark) => ({
            createdAt: bookmark.createdAt.toISOString(),
            setup: {
                id: bookmark.setup.id,
                createdAt: bookmark.setup.createdAt.toISOString(),
                updatedAt: bookmark.setup.updatedAt.toISOString(),
                hidAt: bookmark.setup.hidAt?.toISOString() || null,
                hidReason: bookmark.setup.hidReason,
                user: {
                    ...bookmark.setup.user,
                    createdAt: bookmark.setup.user.createdAt.toISOString(),
                    badges: bookmark.setup.user.badges.map((badge) => ({
                        ...badge,
                        createdAt: badge.createdAt.toISOString(),
                    })),
                },
                name: bookmark.setup.name,
                description: bookmark.setup.description,
                items: bookmark.setup.items.map((item) => ({
                    ...item.item,
                    updatedAt: item.item.updatedAt.toISOString(),
                })),
                images: bookmark.setup.images,
                tags: bookmark.setup.tags.map((tag) => tag.tag),
                coauthors: bookmark.setup.coauthors.map((coauthor) => ({
                    user: {
                        ...coauthor.user,
                        createdAt: coauthor.user.createdAt.toISOString(),
                        badges: coauthor.user.badges.map((badge) => ({
                            ...badge,
                            createdAt: badge.createdAt.toISOString(),
                        })),
                    },
                    note: coauthor.note,
                })),
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
    },
    {
        errorMessage: 'Failed to get bookmarks',
        requireSession: true,
    }
)
