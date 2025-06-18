import {
    bookmarks,
    feedbacks,
    itemCategory,
    items,
    platform,
    setupCoauthors,
    setupImages,
    setupItems,
    setupItemShapekeys,
    setupReports,
    setups,
    setupTags,
    setupTools,
    shops,
    tools,
    user,
    userBadge,
    userBadges,
    userReports,
    userShops,
} from '@@/database/schema'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod/v4'

export const userBadgeSchema = z.enum(userBadge.enumValues)
export type UserBadge = z.infer<typeof userBadgeSchema>

export const platformSchema = z.enum(platform.enumValues)
export type Platform = z.infer<typeof platformSchema>

export const itemCategorySchema = z.enum(itemCategory.enumValues)
export type ItemCategory = z.infer<typeof itemCategorySchema>

export const shopsSelectSchema = createSelectSchema(shops)
export const shopsInsertSchema = createInsertSchema(shops)
export const shopsPublicSchema = shopsSelectSchema.pick({
    id: true,
    platform: true,
    name: true,
    image: true,
    verified: true,
})
export type Shop = z.infer<typeof shopsPublicSchema>

export const userShopsSelectSchema = createSelectSchema(userShops)
export const userShopsInsertSchema = createInsertSchema(userShops)

export const userBadgesSelectSchema = createSelectSchema(userBadges)
export const userBadgesInsertSchema = createInsertSchema(userBadges)

export const userSelectSchema = createSelectSchema(user)
export const userInsertSchema = createInsertSchema(user)
export const userPublicSchema = userSelectSchema
    .pick({
        id: true,
        name: true,
        image: true,
        bio: true,
        links: true,
    })
    .extend({
        createdAt: z.string(),
        badges: z
            .array(
                userBadgesSelectSchema
                    .pick({
                        badge: true,
                    })
                    .extend({
                        createdAt: z.string(),
                    })
            )
            .optional(),
        shops: z
            .array(
                userShopsSelectSchema
                    .omit({
                        id: true,
                        userId: true,
                        shopId: true,
                    })
                    .extend({
                        createdAt: z.string(),
                        shop: shopsPublicSchema,
                    })
            )
            .optional(),
    })
export type User = z.infer<typeof userPublicSchema>
export type UserWithSetups = z.infer<typeof userPublicSchema> & {
    setups: Setup[]
}

export const itemsSelectSchema = createSelectSchema(items)
export const itemsInsertSchema = createInsertSchema(items)
export const itemsPublicSchema = itemsSelectSchema
    .pick({
        id: true,
        platform: true,
        category: true,
        name: true,
        image: true,
        price: true,
        likes: true,
        nsfw: true,
    })
    .extend({
        shop: shopsPublicSchema,
    })
export type Item = z.infer<typeof itemsPublicSchema>

export const toolsSelectSchema = createSelectSchema(tools)
export const toolsInsertSchema = createInsertSchema(tools)
export const toolsPublicSchema = toolsSelectSchema.pick({
    name: true,
    description: true,
    image: true,
    url: true,
})

export const setupItemShapekeysSelectSchema =
    createSelectSchema(setupItemShapekeys)
export const setupItemShapekeysInsertSchema =
    createInsertSchema(setupItemShapekeys)

export const setupItemsSelectSchema = createSelectSchema(setupItems)
export const setupItemsInsertSchema = createInsertSchema(setupItems)
export const setupItemsPublicSchema = z.intersection(
    setupItemsSelectSchema.pick({
        unsupported: true,
        note: true,
    }),
    itemsPublicSchema.extend({
        shop: shopsPublicSchema,
        shapekeys: z.array(
            setupItemShapekeysSelectSchema.pick({
                name: true,
                value: true,
            })
        ),
    })
)
export type SetupItem = z.infer<typeof setupItemsPublicSchema>

export const setupTagsSelectSchema = createSelectSchema(setupTags)
export const setupTagsInsertSchema = createInsertSchema(setupTags)

export const setupImagesSelectSchema = createSelectSchema(setupImages)
export const setupImagesInsertSchema = createInsertSchema(setupImages)

export const setupCoauthorsSelectSchema = createSelectSchema(setupCoauthors)
export const setupCoauthorsInsertSchema = createInsertSchema(setupCoauthors)

export const setupToolsSelectSchema = createSelectSchema(setupTools)
export const setupToolsInsertSchema = createInsertSchema(setupTools)

export const setupsSelectSchema = createSelectSchema(setups)
export const setupsInsertSchema = createInsertSchema(setups)
export const setupsPublicSchema = setupsSelectSchema
    .pick({
        id: true,
        name: true,
        description: true,
    })
    .extend({
        createdAt: z.string(),
        updatedAt: z.string(),
        user: userPublicSchema,
        items: z.array(setupItemsPublicSchema),
        images: z
            .array(
                setupImagesSelectSchema.pick({
                    url: true,
                    width: true,
                    height: true,
                })
            )
            .optional(),
        tags: z.string().array().optional(),
        coauthors: z
            .array(
                z.intersection(
                    userPublicSchema,
                    setupCoauthorsSelectSchema.pick({
                        note: true,
                    })
                )
            )
            .optional(),
        tools: z
            .array(
                setupToolsSelectSchema.pick({
                    toolId: true,
                    note: true,
                })
            )
            .optional(),
    })
export type Setup = z.infer<typeof setupsPublicSchema>

export const bookmarksSelectSchema = createSelectSchema(bookmarks)
export const bookmarksInsertSchema = createInsertSchema(bookmarks)
export const bookmarksPublicSchema = bookmarksSelectSchema
    .pick({
        userId: true,
    })
    .extend({
        createdAt: z.string(),
        setup: setupsPublicSchema,
    })
export type Bookmark = z.infer<typeof bookmarksPublicSchema>

export const feedbacksSelectSchema = createSelectSchema(feedbacks)
export const feedbacksInsertSchema = createInsertSchema(feedbacks)
export const feedbacksPublicSchema = feedbacksSelectSchema
    .pick({
        userId: true,
        comment: true,
        isClosed: true,
    })
    .extend({
        createdAt: z.string(),
    })
export type Feedback = z.infer<typeof feedbacksPublicSchema>

export const setupReportsSelectSchema = createSelectSchema(setupReports)
export const setupReportsInsertSchema = createInsertSchema(setupReports)
export const setupReportsPublicSchema = setupReportsSelectSchema
    .pick({
        reporterId: true,
        spam: true,
        hate: true,
        infringe: true,
        badImage: true,
        other: true,
        comment: true,
        isResolved: true,
    })
    .extend({
        createdAt: z.string(),
        setup: setupsPublicSchema,
    })
export type SetupReport = z.infer<typeof setupReportsPublicSchema>

export const userReportsSelectSchema = createSelectSchema(userReports)
export const userReportsInsertSchema = createInsertSchema(userReports)
export const userReportsPublicSchema = userReportsSelectSchema
    .pick({
        spam: true,
        hate: true,
        infringe: true,
        badImage: true,
        other: true,
        comment: true,
        isResolved: true,
    })
    .extend({
        createdAt: z.string(),
        reporter: userPublicSchema,
        reportee: userPublicSchema,
    })
export type UserReport = z.infer<typeof userReportsPublicSchema>

export interface PaginationResponse<T> {
    data: T
    pagination: {
        page: number
        limit: number
        total: number
        totalPages: number
        hasNext: boolean
        hasPrev: boolean
    }
}

export interface EdgeConfig {
    allowedBoothCategoryId: number[]
    forceUpdateItem: boolean
    isMaintenance: boolean
    isMaintenanceDev: boolean
}
