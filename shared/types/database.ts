import {
    auditActionType,
    auditLogs,
    auditTargetType,
    emails,
    bookmarks,
    feedbacks,
    itemCategory,
    itemReports,
    items,
    notifications,
    notificationType,
    platform,
    setupCoauthors,
    setupDrafts,
    setupImages,
    setupItems,
    setupItemShapekeys,
    setupReports,
    setups,
    setupTags,
    shops,
    users,
    userBadge,
    userBadges,
    userReports,
    userShops,
    type EmailAttachmentMetadata,
    type NotificationPayload,
    userSettings,
} from '@@/database/schema'
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-orm/zod'
import { z } from 'zod'

export const userBadgeSchema = z.enum(userBadge)
export type UserBadge = z.infer<typeof userBadgeSchema>

export const platformSchema = z.enum(platform)
export type Platform = z.infer<typeof platformSchema>

export const itemCategorySchema = z.enum(itemCategory)
export type ItemCategory = z.infer<typeof itemCategorySchema>

export const shopsSelectSchema = createSelectSchema(shops)
export const shopsPublicSchema = shopsSelectSchema.pick({
    id: true,
    platform: true,
    name: true,
    image: true,
    verified: true,
})
export type Shop = z.infer<typeof shopsPublicSchema>

export const userShopsSelectSchema = createSelectSchema(userShops)
export const userShopsPublicSchema = userShopsSelectSchema
    .pick({
        createdAt: true,
    })
    .extend({
        shop: shopsPublicSchema,
    })

export const userBadgesSelectSchema = createSelectSchema(userBadges)
export const userBadgesPublicSchema = userBadgesSelectSchema.pick({
    createdAt: true,
    badge: true,
})

export const userSettingsSelectSchema = createSelectSchema(userSettings)
export const userSettingsUpdateSchema = createUpdateSchema(userSettings).omit({
    id: true,
    userId: true,
    createdAt: true,
    updatedAt: true,
})
export const userSettingsPublicSchema = userSettingsSelectSchema.pick({
    publicFollowees: true,
    publicBookmarks: true,
})
export type UserSettings = z.infer<typeof userSettingsSelectSchema>

export const usersSelectSchema = createSelectSchema(users, {
    links: () => z.string().array().nullable(),
})
export const usersUpdateSchema = createUpdateSchema(users, {
    username: (schema) =>
        schema
            .min(3, 'ID は 3 文字以上必要です。')
            .max(64, 'ID は最大 64 文字です。')
            .refine((val) => /^[a-zA-Z0-9_-]+$/.test(val), '使用できない文字が含まれています。'),
    name: (schema) =>
        schema
            .min(1, 'ユーザー名は 1 文字以上必要です。')
            .max(100, 'ユーザー名は最大 100 文字です。'),
    bio: (schema) => schema.max(300, 'bio は最大 300 文字です。').optional(),
    links: () => z.string().array().max(8, 'リンクは最大 8 個です。').nullable().optional(),
})
export const usersPublicSchema = usersSelectSchema
    .pick({
        id: true,
        username: true,
        createdAt: true,
        name: true,
        image: true,
        bio: true,
        links: true,
        banned: true,
        banReason: true,
        banExpires: true,
    })
    .partial({
        createdAt: true,
        bio: true,
        links: true,
        banned: true,
        banReason: true,
        banExpires: true,
    })
    .extend({
        badges: userBadgesPublicSchema.array().optional(),
        shops: userShopsPublicSchema.array().optional(),
        followersCount: z.number().optional(),
        followeesCount: z.number().optional(),
        isFollowing: z.boolean().optional(),
        isMuted: z.boolean().optional(),
        settings: userSettingsPublicSchema
            .pick({
                publicFollowees: true,
                publicBookmarks: true,
            })
            .partial()
            .nullable()
            .optional(),
    })
export type User = z.infer<typeof usersPublicSchema>

export const itemsSelectSchema = createSelectSchema(items)
export const itemsUpdateSchema = createUpdateSchema(items)
export const itemsPublicSchema = itemsSelectSchema
    .pick({
        id: true,
        platform: true,
        category: true,
        name: true,
        niceName: true,
        image: true,
        price: true,
        likes: true,
        nsfw: true,
        outdated: true,
    })
    .extend({
        shop: shopsPublicSchema.nullable().optional(),
    })
export type Item = z.infer<typeof itemsPublicSchema> & {
    forks?: number
    version?: string
    contributors?: {
        name: string
        contributions: number
    }[]
}

export const setupItemShapekeysSelectSchema = createSelectSchema(setupItemShapekeys)
export const setupItemShapekeysInsertSchema = createInsertSchema(setupItemShapekeys, {
    name: (schema) => schema.min(1).max(64),
})
export const setupItemShapekeysPublicSchema = setupItemShapekeysSelectSchema.pick({
    name: true,
    value: true,
})
export type SetupItemShapekey = z.infer<typeof setupItemShapekeysPublicSchema>

export const setupItemsSelectSchema = createSelectSchema(setupItems)
export const setupItemsInsertSchema = createInsertSchema(setupItems, {
    itemId: () => z.union([z.string(), z.number()]).transform((val) => val.toString()),
    note: (schema) => schema.max(300, 'ノートは最大 300 文字です。').optional(),
}).extend({
    shapekeys: setupItemShapekeysInsertSchema
        .omit({ setupItemId: true })
        .array()
        .max(64)
        .optional(),
})
export const setupItemsPublicSchema = z.intersection(
    itemsPublicSchema,
    setupItemsSelectSchema
        .partial()
        .pick({
            unsupported: true,
            note: true,
            category: true,
        })
        .extend({
            shapekeys: setupItemShapekeysPublicSchema.array().optional(),
        }),
)
export type SetupItem = z.infer<typeof setupItemsPublicSchema> & {
    forks?: number
    version?: string
    contributors?: {
        name: string
        avatar?: string
    }[]
}

export const setupTagsInsertSchema = createInsertSchema(setupTags, {
    tag: (schema) =>
        schema.min(1, 'タグは 1 文字以上必要です。').max(32, 'タグは最大 32 文字です。'),
})

export const setupImagesSelectSchema = createSelectSchema(setupImages, {
    themeColors: () => z.string().array().nullable(),
})
export const setupImagesPublicSchema = setupImagesSelectSchema
    .pick({
        objectKey: true,
        width: true,
        height: true,
        themeColors: true,
        contentType: true,
        size: true,
        etag: true,
    })
    .extend({
        url: z.string().min(1),
    })
    .partial({
        themeColors: true,
        contentType: true,
        size: true,
        etag: true,
    })

export const setupImageMetadataSchema = z.object({
    objectKey: z.string().min(1),
    contentType: z.string().optional(),
    size: z.number().int().min(1).optional(),
    etag: z.string().nullable().optional(),
    width: z.number().int().min(1).max(8192),
    height: z.number().int().min(1).max(8192),
    themeColors: z
        .string()
        .regex(/^#[\da-f]{6}$/i)
        .array()
        .max(8)
        .nullable()
        .optional(),
})
export type SetupImageMetadata = z.infer<typeof setupImageMetadataSchema>

export const setupCoauthorsSelectSchema = createSelectSchema(setupCoauthors)
export const setupCoauthorsInsertSchema = createInsertSchema(setupCoauthors, {
    note: (schema) => schema.max(140, 'ノートは最大 140 文字です。').optional(),
})
export const setupCoauthorsPublicSchema = setupCoauthorsSelectSchema
    .pick({
        note: true,
    })
    .partial()
    .extend({
        user: usersPublicSchema,
    })

export const setupsSelectSchema = createSelectSchema(setups)
export const setupsInsertSchema = createInsertSchema(setups, {
    name: (schema) =>
        schema
            .min(1, 'セットアップ名は 1 文字以上必要です。')
            .max(64, 'セットアップ名は最大 64 文字です。'),
    description: (schema) => schema.max(512, '説明文は最大 512 文字です。').optional(),
})
    .omit({ userId: true })
    .extend({
        tags: setupTagsInsertSchema
            .omit({ setupId: true })
            .array()
            .max(8, 'タグは最大 8 個です。')
            .optional(),
        images: z.string().min(1).array().max(1, '画像は最大 1 個です。').optional(),
        imageMetadata: z.record(z.string(), setupImageMetadataSchema).optional(),
        coauthors: setupCoauthorsInsertSchema
            .omit({ setupId: true })
            .array()
            .max(8, '共同作者は最大 8 人です。')
            .optional(),
        items: setupItemsInsertSchema
            .omit({ setupId: true })
            .array()
            .max(32, 'アイテムは最大 32 個です。'),
    })
export const setupsUpdateSchema = createUpdateSchema(setups, {
    name: (schema) =>
        schema
            .min(1, 'セットアップ名は 1 文字以上必要です。')
            .max(64, 'セットアップ名は最大 64 文字です。')
            .optional(),
    description: (schema) => schema.max(512, '説明文は最大 512 文字です。').optional(),
}).extend({
    tags: setupTagsInsertSchema
        .omit({ setupId: true })
        .array()
        .max(8, 'タグは最大 8 個です。')
        .optional(),
    images: z.string().min(1).array().max(1, '画像は最大 1 個です。').optional(),
    imageMetadata: z.record(z.string(), setupImageMetadataSchema).optional(),
    coauthors: setupCoauthorsInsertSchema
        .omit({ setupId: true })
        .array()
        .max(8, '共同作者は最大 8 人です。')
        .optional(),
    items: setupItemsInsertSchema
        .omit({ setupId: true })
        .array()
        .min(1, 'アイテムは1個以上必要です。')
        .max(32, 'アイテムは最大 32 個です。'),
})
export const setupsClientFormSchema = createInsertSchema(setups, {
    name: (schema) =>
        schema
            .min(1, 'セットアップ名は 1 文字以上必要です。')
            .max(64, 'セットアップ名は最大 64 文字です。'),
    description: (schema) => schema.max(512, '説明文は最大 512 文字です。').optional(),
})
    .pick({
        public: true,
        name: true,
        description: true,
    })
    .extend({
        tags: z.string().array().max(8, 'タグは最大 8 個です。'),
        images: z.url().array().max(1, '画像は最大 1 個です。'),
        coauthors: setupCoauthorsInsertSchema
            .omit({
                setupId: true,
            })
            .extend({
                user: usersPublicSchema.pick({
                    username: true,
                    name: true,
                    image: true,
                }),
            })
            .array()
            .max(8, '共同作者は最大 8 人です。'),
        items: z.record(
            itemCategorySchema,
            setupItemsPublicSchema
                .transform((item) => ({
                    ...item,
                    id: item.id.toString(),
                }))
                .array(),
        ),
    })
    .refine(
        (val) => {
            const totalItems = Object.values(val.items).reduce(
                (total, category) => total + category.length,
                0,
            )
            return totalItems > 0
        },
        {
            message: 'アイテムは1個以上必要です。',
            path: ['items'],
        },
    )
    .refine(
        (val) => {
            const totalItems = Object.values(val.items).reduce(
                (total, category) => total + category.length,
                0,
            )
            return totalItems <= MAX_ITEMS_PER_SETUP
        },
        {
            message: `アイテムは最大${MAX_ITEMS_PER_SETUP}個です。`,
            path: ['items'],
        },
    )
export const setupsPublicSchema = setupsSelectSchema
    .pick({
        id: true,
        createdAt: true,
        updatedAt: true,
        public: true,
        name: true,
        description: true,
        hidAt: true,
        hidReason: true,
    })
    .partial({
        description: true,
        hidAt: true,
        hidReason: true,
    })
    .extend({
        user: usersPublicSchema,
        items: setupItemsPublicSchema.array(),
        images: setupImagesPublicSchema.array().optional(),
        tags: z.string().array().optional(),
        coauthors: setupCoauthorsPublicSchema.array().optional(),
        failedItemsCount: z.number().min(0).optional(),
    })
export type Setup = z.infer<typeof setupsPublicSchema>

export const setupDraftContentSchema = setupsInsertSchema
    .pick({
        public: true,
        name: true,
        description: true,
        tags: true,
        images: true,
        imageMetadata: true,
        items: true,
    })
    .partial()
    .extend({
        coauthors: setupCoauthorsInsertSchema
            .omit({ setupId: true })
            .extend({
                username: z.string(),
            })
            .array()
            .max(8)
            .optional(),
    })
export const setupDraftsSelectSchema = createSelectSchema(setupDrafts)
export const setupDraftsInsertSchema = createInsertSchema(setupDrafts, {
    content: () => setupDraftContentSchema,
})
export const setupDraftsPublicSchema = setupDraftsSelectSchema
    .pick({
        id: true,
        createdAt: true,
        updatedAt: true,
        setupId: true,
    })
    .extend({
        content: setupDraftContentSchema,
    })
export type SetupDraftContent = z.infer<typeof setupDraftContentSchema>
export type SetupDraft = z.infer<typeof setupDraftsPublicSchema>

export const bookmarksSelectSchema = createSelectSchema(bookmarks)
export const bookmarksPublicSchema = bookmarksSelectSchema
    .pick({
        createdAt: true,
    })
    .extend({
        setup: setupsPublicSchema,
    })
export type Bookmark = z.infer<typeof bookmarksPublicSchema>

export const feedbacksSelectSchema = createSelectSchema(feedbacks)
export const feedbacksInsertSchema = createInsertSchema(feedbacks, {
    comment: (schema) =>
        schema
            .min(1, 'コメントは 1 文字以上必要です。')
            .max(1000, 'コメントは最大 1000 文字です。'),
})
export const feedbacksPublicSchema = feedbacksSelectSchema.pick({
    id: true,
    createdAt: true,
    fingerprint: true,
    contextPath: true,
    comment: true,
    isClosed: true,
})
export type Feedback = z.infer<typeof feedbacksPublicSchema>

export const itemReportsInsertSchema = createInsertSchema(itemReports, {
    comment: (schema) => schema.max(1000, 'コメントは最大 1000 文字です。').optional(),
})
    .pick({
        itemId: true,
        nameError: true,
        irrelevant: true,
        other: true,
        comment: true,
    })
    .refine((data) => data.nameError || data.irrelevant || data.other)
export const itemReportsUpdateSchema = createUpdateSchema(itemReports)

export const setupReportsInsertSchema = createInsertSchema(setupReports, {
    comment: (schema) => schema.max(1000, 'コメントは最大 1000 文字です。').optional(),
})
    .pick({
        setupId: true,
        spam: true,
        hate: true,
        infringe: true,
        badImage: true,
        other: true,
        comment: true,
    })
    .refine((data) => data.spam || data.hate || data.infringe || data.badImage || data.other)
export const setupReportsUpdateSchema = createUpdateSchema(setupReports)

export const userReportsInsertSchema = createInsertSchema(userReports, {
    comment: (schema) => schema.max(1000, 'コメントは最大 1000 文字です。').optional(),
})
    .pick({
        reporteeId: true,
        spam: true,
        hate: true,
        infringe: true,
        badImage: true,
        other: true,
        comment: true,
    })
    .refine((data) => data.spam || data.hate || data.infringe || data.badImage || data.other)
export const userReportsUpdateSchema = createUpdateSchema(userReports)

export const auditActionTypeSchema = z.enum(auditActionType)
export type AuditActionType = z.infer<typeof auditActionTypeSchema>

export const auditTargetTypeSchema = z.enum(auditTargetType)

export const auditLogsSelectSchema = createSelectSchema(auditLogs)
export const auditLogsInsertSchema = createInsertSchema(auditLogs)
export const auditLogsPublicSchema = auditLogsSelectSchema
    .pick({
        id: true,
        createdAt: true,
        action: true,
        targetType: true,
        targetId: true,
        details: true,
    })
    .extend({
        user: usersPublicSchema.nullable(),
    })
export type AuditLog = z.infer<typeof auditLogsPublicSchema>

export const emailsSelectSchema = createSelectSchema(emails)
export const emailsPublicSchema = emailsSelectSchema.pick({
    id: true,
    messageId: true,
    subject: true,
    fromAddress: true,
    fromName: true,
    toAddress: true,
    snippet: true,
    isRead: true,
    isArchived: true,
    receivedAt: true,
})
export type Email = z.infer<typeof emailsPublicSchema>
export type EmailAttachment = EmailAttachmentMetadata

export const notificationTypeSchema = z.enum(notificationType)
export type NotificationType = z.infer<typeof notificationTypeSchema>

export const notificationsSelectSchema = createSelectSchema(notifications)
export const notificationsInsertSchema = createInsertSchema(notifications)
export const notificationsPublicSchema = notificationsSelectSchema.pick({
    id: true,
    createdAt: true,
    type: true,
    readAt: true,
    payload: true,
    actionUrl: true,
    banner: true,
})
export type Notification = Omit<z.infer<typeof notificationsPublicSchema>, 'payload'> & {
    payload: NotificationPayload
}
