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
import {
    createInsertSchema,
    createSelectSchema,
    createUpdateSchema,
} from 'drizzle-zod'
import { z } from 'zod/v4'

export const userBadgeSchema = z.enum(userBadge.enumValues)
export type UserBadge = z.infer<typeof userBadgeSchema>

export const platformSchema = z.enum(platform.enumValues)
export type Platform = z.infer<typeof platformSchema>

export const itemCategorySchema = z.enum(itemCategory.enumValues)
export type ItemCategory = z.infer<typeof itemCategorySchema>

export const shopsSelectSchema = createSelectSchema(shops, {
    createdAt: (schema) => schema.transform((val) => val.toISOString()),
    updatedAt: (schema) => schema.transform((val) => val.toISOString()),
})
export const shopsInsertSchema = createInsertSchema(shops)
export const shopsUpdateSchema = createUpdateSchema(shops)
export const shopsPublicSchema = shopsSelectSchema.pick({
    id: true,
    platform: true,
    name: true,
    image: true,
    verified: true,
})
export type Shop = z.infer<typeof shopsPublicSchema>

export const userShopsSelectSchema = createSelectSchema(userShops, {
    createdAt: (schema) => schema.transform((val) => val.toISOString()),
})
export const userShopsInsertSchema = createInsertSchema(userShops)
export const userShopsPublicSchema = userShopsSelectSchema
    .pick({
        createdAt: true,
    })
    .extend({
        shop: shopsPublicSchema,
    })

export const userBadgesSelectSchema = createSelectSchema(userBadges, {
    createdAt: (schema) => schema.transform((val) => val.toISOString()),
})
export const userBadgesInsertSchema = createInsertSchema(userBadges)
export const userBadgesPublicSchema = userBadgesSelectSchema.pick({
    createdAt: true,
    badge: true,
})

export const userSelectSchema = createSelectSchema(user, {
    createdAt: (schema) => schema.transform((val) => val.toISOString()),
    updatedAt: (schema) => schema.transform((val) => val.toISOString()),
    banExpires: (schema) => schema.transform((val) => val?.toISOString()),
})
export const userInsertSchema = createInsertSchema(user, {
    id: (schema) =>
        schema
            .min(3, 'ID は 3 文字以上必要です。')
            .max(64, 'ID は最大 64 文字です。')
            .refine(
                (val) => /^[a-zA-Z0-9_-]+$/.test(val),
                '使用できない文字が含まれています。'
            ),
    name: (schema) =>
        schema
            .min(1, 'ユーザー名は 1 文字以上必要です。')
            .max(100, 'ユーザー名は最大 100 文字です。'),
    bio: (schema) => schema.max(300, 'bio は最大 300 文字です。').optional(),
    links: (schema) => schema.max(8, 'リンクは最大 8 個です。').optional(),
})
export const userUpdateSchema = createUpdateSchema(user, {
    id: (schema) =>
        schema
            .min(3, 'ID は 3 文字以上必要です。')
            .max(64, 'ID は最大 64 文字です。')
            .refine(
                (val) => /^[a-zA-Z0-9_-]+$/.test(val),
                '使用できない文字が含まれています。'
            ),
    name: (schema) =>
        schema
            .min(1, 'ユーザー名は 1 文字以上必要です。')
            .max(100, 'ユーザー名は最大 100 文字です。'),
    bio: (schema) => schema.max(300, 'bio は最大 300 文字です。').optional(),
    links: (schema) => schema.max(8, 'リンクは最大 8 個です。').optional(),
})
export const userPublicSchema = userSelectSchema
    .pick({
        id: true,
        createdAt: true,
        name: true,
        image: true,
        bio: true,
        links: true,
    })
    .extend({
        badges: userBadgesPublicSchema.array().optional(),
        shops: userShopsPublicSchema.array().optional(),
    })
export type User = z.infer<typeof userPublicSchema>
export type UserWithSetups = z.infer<typeof userPublicSchema> & {
    setups: Setup[]
}

export const itemsSelectSchema = createSelectSchema(items, {
    createdAt: (schema) => schema.transform((val) => val.toISOString()),
    updatedAt: (schema) => schema.transform((val) => val.toISOString()),
})
export const itemsInsertSchema = createInsertSchema(items)
export const itemsUpdateSchema = createUpdateSchema(items)
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
        outdated: z.boolean().optional(),
    })
export type Item = z.infer<typeof itemsPublicSchema>

export const toolsSelectSchema = createSelectSchema(tools, {
    createdAt: (schema) => schema.transform((val) => val.toISOString()),
    updatedAt: (schema) => schema.transform((val) => val.toISOString()),
})
export const toolsInsertSchema = createInsertSchema(tools)
export const toolsUpdateSchema = createUpdateSchema(tools)
export const toolsPublicSchema = toolsSelectSchema.pick({
    slug: true,
    name: true,
    description: true,
    image: true,
    url: true,
})
export type Tool = z.infer<typeof toolsPublicSchema>

export const setupItemShapekeysSelectSchema =
    createSelectSchema(setupItemShapekeys)
export const setupItemShapekeysInsertSchema = createInsertSchema(
    setupItemShapekeys,
    {
        name: (schema) => schema.min(1).max(64),
    }
)
export const setupItemShapekeysPublicSchema =
    setupItemShapekeysSelectSchema.pick({
        name: true,
        value: true,
    })
export type SetupItemShapekey = z.infer<typeof setupItemShapekeysPublicSchema>

export const setupItemsSelectSchema = createSelectSchema(setupItems)
export const setupItemsInsertSchema = createInsertSchema(setupItems, {
    note: (schema) => schema.max(300, 'ノートは最大 300 文字です。').optional(),
}).extend({
    shapekeys: setupItemShapekeysInsertSchema.array().max(64).optional(),
})
export const setupItemsPublicSchema = z.intersection(
    itemsPublicSchema,
    setupItemsSelectSchema
        .pick({
            unsupported: true,
            note: true,
            category: true,
        })
        .extend({
            shapekeys: setupItemShapekeysPublicSchema.array().optional(),
        })
)
export type SetupItem = z.infer<typeof setupItemsPublicSchema>

export const setupTagsSelectSchema = createSelectSchema(setupTags)
export const setupTagsInsertSchema = createInsertSchema(setupTags, {
    tag: (schema) =>
        schema
            .min(1, 'タグは 1 文字以上必要です。')
            .max(32, 'タグは最大 32 文字です。'),
})
export const setupTagsPublicSchema = setupTagsSelectSchema.pick({
    tag: true,
})

export const setupImagesSelectSchema = createSelectSchema(setupImages)
export const setupImagesInsertSchema = createInsertSchema(setupImages)
export const setupImagesPublicSchema = setupImagesSelectSchema.pick({
    url: true,
    width: true,
    height: true,
})
export type SetupImage = z.infer<typeof setupImagesPublicSchema>

export const setupCoauthorsSelectSchema = createSelectSchema(setupCoauthors)
export const setupCoauthorsInsertSchema = createInsertSchema(setupCoauthors, {
    note: (schema) => schema.max(140, 'ノートは最大 140 文字です。').optional(),
})
export const setupCoauthorsPublicSchema = setupCoauthorsSelectSchema
    .pick({
        note: true,
    })
    .extend({
        user: userPublicSchema,
    })
export type SetupCoauthor = z.infer<typeof setupCoauthorsPublicSchema>

export const setupToolsSelectSchema = createSelectSchema(setupTools)
export const setupToolsInsertSchema = createInsertSchema(setupTools, {
    version: (schema) =>
        schema.max(32, 'バージョンは最大 32 文字です。').optional(),
    note: (schema) => schema.max(140, 'ノートは最大 140 文字です。').optional(),
})
export const setupToolsPublicSchema = setupToolsSelectSchema
    .pick({
        version: true,
        note: true,
    })
    .extend({
        tool: toolsPublicSchema,
    })
export type SetupTool = z.infer<typeof setupToolsPublicSchema>

export const setupsSelectSchema = createSelectSchema(setups, {
    createdAt: (schema) => schema.transform((val) => val.toISOString()),
    updatedAt: (schema) => schema.transform((val) => val.toISOString()),
})
export const setupsInsertSchema = createInsertSchema(setups, {
    name: (schema) =>
        schema
            .min(1, 'セットアップ名は 1 文字以上必要です。')
            .max(64, 'セットアップ名は最大 64 文字です。'),
    description: (schema) =>
        schema.max(512, '説明文は最大 512 文字です。').optional(),
}).extend({
    tags: setupTagsInsertSchema
        .array()
        .max(8, 'タグは最大 8 個です。')
        .optional(),
    images: setupImagesInsertSchema
        .array()
        .max(1, '画像は最大 1 個です。')
        .optional(),
    coauthors: setupCoauthorsInsertSchema
        .array()
        .max(8, '共同作者は最大 8 人です。')
        .optional(),
    tools: setupToolsInsertSchema
        .array()
        .max(8, 'ツールは最大 8 個です。')
        .optional(),
    items: setupItemsInsertSchema
        .array()
        .max(32, 'アイテムは最大 32 個です。')
        .optional(),
})
export const setupsUpdateSchema = createUpdateSchema(setups, {
    name: (schema) =>
        schema
            .min(1, 'セットアップ名は 1 文字以上必要です。')
            .max(64, 'セットアップ名は最大 64 文字です。')
            .optional(),
    description: (schema) =>
        schema.max(512, '説明文は最大 512 文字です。').optional(),
    visibility: (schema) => schema.optional(),
})
export const setupsPublicSchema = setupsSelectSchema
    .pick({
        id: true,
        createdAt: true,
        updatedAt: true,
        name: true,
        description: true,
    })
    .extend({
        user: userPublicSchema,
        items: setupItemsPublicSchema.array(),
        images: setupImagesPublicSchema.array().optional(),
        tags: z.string().array().optional(),
        coauthors: setupCoauthorsPublicSchema.array().optional(),
        failedItemsCount: z.number().min(0).optional(),
    })
export type Setup = z.infer<typeof setupsPublicSchema>

export const bookmarksSelectSchema = createSelectSchema(bookmarks, {
    createdAt: (schema) => schema.transform((val) => val.toISOString()),
})
export const bookmarksInsertSchema = createInsertSchema(bookmarks)
export const bookmarksPublicSchema = bookmarksSelectSchema
    .pick({
        createdAt: true,
    })
    .extend({
        setup: setupsPublicSchema,
    })
export type Bookmark = z.infer<typeof bookmarksPublicSchema>

export const feedbacksSelectSchema = createSelectSchema(feedbacks, {
    createdAt: (schema) => schema.transform((val) => val.toISOString()),
})
export const feedbacksInsertSchema = createInsertSchema(feedbacks, {
    comment: (schema) =>
        schema
            .min(1, 'コメントは 1 文字以上必要です。')
            .max(1000, 'コメントは最大 1000 文字です。'),
})
export const feedbacksPublicSchema = feedbacksSelectSchema
    .pick({
        id: true,
        createdAt: true,
        comment: true,
        isClosed: true,
    })
    .extend({
        user: userPublicSchema,
    })
export type Feedback = z.infer<typeof feedbacksPublicSchema>

export const setupReportsSelectSchema = createSelectSchema(setupReports, {
    createdAt: (schema) => schema.transform((val) => val.toISOString()),
})
export const setupReportsInsertSchema = createInsertSchema(setupReports, {
    comment: (schema) =>
        schema.max(1000, 'コメントは最大 1000 文字です。').optional(),
}).refine(
    (data) =>
        data.spam || data.hate || data.infringe || data.badImage || data.other
)
export const setupReportsPublicSchema = setupReportsSelectSchema
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
        reporter: userPublicSchema,
        setup: setupsPublicSchema,
    })
export type SetupReport = z.infer<typeof setupReportsPublicSchema>

export const userReportsSelectSchema = createSelectSchema(userReports, {
    createdAt: (schema) => schema.transform((val) => val.toISOString()),
})
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
