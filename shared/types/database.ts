import { itemCategorySchema } from '@avatio/core/catalog'
import {
    setupComposeFormSchema,
    setupDraftContentSchema,
    type SetupDraftContent,
} from '@avatio/core/setups'
import { z } from 'zod'

import { setupEntryPublicSchema } from './catalog'

// Explicit HTTP contracts remain independent from database schema types.
export const userBadgeSchema = z.enum([
    'developer',
    'contributor',
    'translator',
    'alpha_tester',
    'shop_owner',
    'publisher_owner',
    'patrol',
    'idea_man',
])
export type UserBadge = z.infer<typeof userBadgeSchema>

export { itemCategorySchema }
export type ItemCategory = z.infer<typeof itemCategorySchema>

export const userBadgesPublicSchema = z.object({
    createdAt: z.date(),
    badge: userBadgeSchema,
})

export const publisherSourcePublicSchema = z.object({
    id: z.string(),
    providerKey: z.string(),
    externalId: z.string(),
    canonicalUrl: z.url(),
    name: z.string(),
    image: z.string().nullable(),
    providerVerified: z.boolean(),
})

export const publisherOwnershipPublicSchema = z.object({
    id: z.string(),
    method: z.string(),
    verifiedAt: z.date(),
    publisherSource: publisherSourcePublicSchema,
})

export const userSettingsUpdateSchema = z.object({
    showPrivateSetups: z.boolean().optional(),
    showNSFW: z.boolean().optional(),
})

export const usernameSchema = z
    .string()
    .min(3, 'ID は 3 文字以上必要です。')
    .max(64, 'ID は最大 64 文字です。')
    .regex(/^[a-zA-Z0-9_-]+$/, '使用できない文字が含まれています。')

export const usersUpdateSchema = z.object({
    username: usernameSchema.optional(),
    name: z
        .string()
        .min(1, 'ユーザー名は 1 文字以上必要です。')
        .max(100, 'ユーザー名は最大 100 文字です。')
        .optional(),
    image: z.string().nullable().optional(),
    bio: z.string().max(300, 'bio は最大 300 文字です。').nullable().optional(),
    links: z.string().array().max(8, 'リンクは最大 8 個です。').nullable().optional(),
})

export const usersPublicSchema = z.object({
    id: z.string(),
    username: z.string(),
    createdAt: z.date().optional(),
    name: z.string(),
    image: z.string().nullable(),
    bio: z.string().nullable().optional(),
    links: z.string().array().nullable().optional(),
    banned: z.boolean().nullable().optional(),
    banReason: z.string().nullable().optional(),
    banExpires: z.date().nullable().optional(),
    badges: userBadgesPublicSchema.array().optional(),
    publisherOwnerships: publisherOwnershipPublicSchema.array().optional(),
})
export type User = z.infer<typeof usersPublicSchema>

export const setupEntryShapekeysInsertSchema = z.object({
    name: z.string().min(1).max(64),
    value: z.number(),
})
export const setupEntryShapekeysPublicSchema = setupEntryShapekeysInsertSchema.pick({
    name: true,
    value: true,
})
export type SetupEntryShapekey = z.infer<typeof setupEntryShapekeysPublicSchema>

export const setupEntriesInsertSchema = z.object({
    id: z.string().min(1).optional(),
    itemId: z.string().min(1),
    category: itemCategorySchema.nullable().optional(),
    unsupported: z.boolean().default(false),
    note: z.string().max(300, 'ノートは最大 300 文字です。').nullable().optional(),
    shapekeys: setupEntryShapekeysPublicSchema.array().max(64).optional(),
})

export const setupTagsInsertSchema = z.object({
    tag: z.string().min(1, 'タグは 1 文字以上必要です。').max(32, 'タグは最大 32 文字です。'),
})

export const setupImagesPublicSchema = z.object({
    id: z.string(),
    position: z.number().int().min(0),
    objectKey: z.string(),
    width: z.number().int(),
    height: z.number().int(),
    themeColors: z.string().array().nullable().optional(),
    contentType: z.string().nullable().optional(),
    size: z.number().int().nullable().optional(),
    etag: z.string().nullable().optional(),
    url: z.string().min(1),
})

export const setupImageMetadataSchema = z.object({
    id: z.string().min(1).optional(),
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

export const setupPointSchema = z.object({
    id: z.string().min(1),
    imageId: z.string().min(1),
    entryId: z.string().min(1),
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
})
export type SetupPoint = z.infer<typeof setupPointSchema>

export const setupCoauthorsInsertSchema = z.object({
    userId: z.string(),
    note: z.string().max(140, 'ノートは最大 140 文字です。').nullable().optional(),
})
export const setupCoauthorsPublicSchema = z.object({
    note: z.string().nullable().optional(),
    user: usersPublicSchema,
})

const setupNameSchema = z
    .string()
    .min(1, 'セットアップ名は 1 文字以上必要です。')
    .max(64, 'セットアップ名は最大 64 文字です。')
const setupDescriptionSchema = z.string().max(512, '説明文は最大 512 文字です。').nullable()
const setupRelationsSchema = {
    tags: setupTagsInsertSchema.array().max(8, 'タグは最大 8 個です。').optional(),
    images: z.string().min(1).array().max(4, '画像は最大 4 個です。').optional(),
    imageMetadata: z.record(z.string(), setupImageMetadataSchema).optional(),
    coauthors: setupCoauthorsInsertSchema.array().max(8, '共同作者は最大 8 人です。').optional(),
    points: setupPointSchema.array().max(128).optional(),
} as const

export const setupsInsertSchema = z.object({
    public: z.boolean().default(true),
    name: setupNameSchema,
    description: setupDescriptionSchema.optional(),
    ...setupRelationsSchema,
    points: setupPointSchema.array().max(128).default([]),
    items: setupEntriesInsertSchema
        .array()
        .min(1, 'アイテムは1個以上必要です。')
        .max(MAX_ITEMS_PER_SETUP, `アイテムは最大 ${MAX_ITEMS_PER_SETUP} 個です。`),
})

export const setupsUpdateSchema = z.object({
    public: z.boolean().optional(),
    name: setupNameSchema.optional(),
    description: setupDescriptionSchema.optional(),
    ...setupRelationsSchema,
    items: setupEntriesInsertSchema
        .array()
        .min(1, 'アイテムは1個以上必要です。')
        .max(MAX_ITEMS_PER_SETUP, `アイテムは最大 ${MAX_ITEMS_PER_SETUP} 個です。`),
})

export const setupsClientFormSchema = z.object({
    public: z.boolean(),
    name: setupNameSchema,
    description: setupDescriptionSchema.optional(),
    tags: z.string().array().max(8, 'タグは最大 8 個です。'),
    images: z.url().array().max(4, '画像は最大 4 個です。'),
    coauthors: setupCoauthorsInsertSchema
        .extend({ user: usersPublicSchema.pick({ username: true, name: true, image: true }) })
        .array()
        .max(8, '共同作者は最大 8 人です。'),
    entries: setupEntryPublicSchema.array().min(1).max(MAX_ITEMS_PER_SETUP),
    points: setupPointSchema.array().max(128),
})

export const setupsPublicSchema = z.object({
    id: z.string(),
    createdAt: z.date(),
    updatedAt: z.date(),
    public: z.boolean(),
    name: z.string(),
    description: z.string().nullable().optional(),
    hidAt: z.date().nullable().optional(),
    hidReason: z.string().nullable().optional(),
    user: usersPublicSchema,
    entries: setupEntryPublicSchema.array(),
    images: setupImagesPublicSchema.array().optional(),
    tags: z.string().array().optional(),
    coauthors: setupCoauthorsPublicSchema.array().optional(),
    points: setupPointSchema.array().optional(),
    failedItemsCount: z.number().min(0).optional(),
})
export type Setup = z.infer<typeof setupsPublicSchema>

export { setupComposeFormSchema, setupDraftContentSchema }

export const setupDraftsUpdateSchema = z.object({
    expectedRevision: z.number().int().min(0),
    setupId: z.string().nullable(),
    content: setupDraftContentSchema,
})
export const setupDraftsPublicSchema = z.object({
    id: z.string(),
    createdAt: z.date(),
    updatedAt: z.date(),
    setupId: z.string().nullable(),
    revision: z.number().int().min(1),
    content: setupDraftContentSchema,
})
export const setupDraftSummarySchema = setupDraftsPublicSchema
    .omit({ content: true })
    .extend({ name: z.string(), description: z.string(), itemCount: z.number().int().min(0) })
export type { SetupDraftContent }
export type SetupDraft = z.infer<typeof setupDraftsPublicSchema>
export type SetupDraftSummary = z.infer<typeof setupDraftSummarySchema>

export const bookmarksPublicSchema = z.object({
    createdAt: z.date(),
    setup: setupsPublicSchema,
})
export type Bookmark = z.infer<typeof bookmarksPublicSchema>

export const feedbacksInsertSchema = z.object({
    comment: z
        .string()
        .min(1, 'コメントは 1 文字以上必要です。')
        .max(1000, 'コメントは最大 1000 文字です。'),
    contextPath: z.string().nullable().optional(),
})
export const feedbacksPublicSchema = z.object({
    id: z.number().int(),
    createdAt: z.date(),
    fingerprint: z.string(),
    contextPath: z.string().nullable(),
    comment: z.string(),
    isClosed: z.boolean(),
})
export type Feedback = z.infer<typeof feedbacksPublicSchema>

const reportCommentSchema = z
    .string()
    .max(1000, 'コメントは最大 1000 文字です。')
    .nullable()
    .optional()
export const itemReportsInsertSchema = z
    .object({
        itemId: z.string(),
        nameError: z.boolean().default(false),
        irrelevant: z.boolean().default(false),
        other: z.boolean().default(false),
        comment: reportCommentSchema,
    })
    .refine((data) => data.nameError || data.irrelevant || data.other)

const setupOrUserReportFields = {
    spam: z.boolean().default(false),
    hate: z.boolean().default(false),
    infringe: z.boolean().default(false),
    badImage: z.boolean().default(false),
    other: z.boolean().default(false),
    comment: reportCommentSchema,
} as const

export const setupReportsInsertSchema = z
    .object({ setupId: z.string(), ...setupOrUserReportFields })
    .refine((data) => data.spam || data.hate || data.infringe || data.badImage || data.other)
export const userReportsInsertSchema = z
    .object({ reporteeId: z.string(), ...setupOrUserReportFields })
    .refine((data) => data.spam || data.hate || data.infringe || data.badImage || data.other)

const reportUpdateSchema = z.object({ isResolved: z.boolean().optional() })
export const itemReportsUpdateSchema = reportUpdateSchema
export const setupReportsUpdateSchema = reportUpdateSchema
export const userReportsUpdateSchema = reportUpdateSchema

export const auditActionTypeSchema = z.enum([
    'user_ban',
    'user_unban',
    'user_delete',
    'user_role_change',
    'user_shop_verify',
    'user_shop_unverify',
    'user_badge_grant',
    'user_badge_revoke',
    'setup_hide',
    'setup_unhide',
    'setup_delete',
    'report_resolve',
    'feedback_close',
    'cleanup',
    'image_upload_url_create',
    'image_upload_complete',
    'image_move',
    'image_delete',
    'image_cleanup',
])
export type AuditActionType = z.infer<typeof auditActionTypeSchema>

export const auditTargetTypeSchema = z.enum([
    'user',
    'setup',
    'report',
    'feedback',
    'badge',
    'system',
    'image',
])
export const auditLogsInsertSchema = z.object({
    userId: z.string().nullable().optional(),
    action: auditActionTypeSchema,
    targetType: auditTargetTypeSchema,
    targetId: z.string().nullable().optional(),
    details: z.string().nullable().optional(),
})
export const auditLogsPublicSchema = z.object({
    id: z.number().int(),
    createdAt: z.date(),
    action: auditActionTypeSchema,
    targetType: auditTargetTypeSchema,
    targetId: z.string().nullable(),
    details: z.string().nullable(),
    user: usersPublicSchema.nullable(),
})
export type AuditLog = z.infer<typeof auditLogsPublicSchema>

export interface EmailAttachmentMetadata {
    filename: string | null
    size: number | null
    type: string
    disposition?: 'attachment' | 'inline' | null
    contentId?: string
}
export type EmailAttachment = EmailAttachmentMetadata
export const emailsPublicSchema = z.object({
    id: z.number().int(),
    messageId: z.string(),
    subject: z.string().nullable(),
    fromAddress: z.string(),
    fromName: z.string().nullable(),
    toAddress: z.string(),
    snippet: z.string().nullable(),
    isRead: z.boolean(),
    isArchived: z.boolean(),
    receivedAt: z.date(),
})
export type Email = z.infer<typeof emailsPublicSchema>

export const notificationTypeSchema = z.enum([
    'system_announcement',
    'user_badge_granted',
    'setup_coauthor_added',
    'user_role_changed',
    'user_banned',
    'user_unbanned',
    'user_followed',
    'setup_created',
])
export type NotificationType = z.infer<typeof notificationTypeSchema>
export interface NotificationPayload {
    user?: { username: string | null | undefined; name: string }
    setup?: { id: string; name: string }
    banExpiresIn?: number
    content?: string
    customTranslations?: Record<string, { title: string; message?: string; actionLabel?: string }>
}
export const notificationsInsertSchema = z.object({
    userId: z.string(),
    type: notificationTypeSchema,
    payload: z.unknown(),
    actionUrl: z.string().nullable().optional(),
    banner: z.boolean().default(false),
    dedupeKey: z.string().nullable().optional(),
})
export interface Notification {
    id: string
    createdAt: Date
    type: NotificationType
    readAt: Date | null
    payload: NotificationPayload
    actionUrl: string | null
    banner: boolean
}
