import {
    bigint,
    boolean,
    foreignKey,
    index,
    integer,
    jsonb,
    pgEnum,
    real,
    text,
    timestamp,
    uniqueIndex,
    uuid,
    snakeCase,
} from 'drizzle-orm/pg-core'
import { nanoid } from 'nanoid'

export const locales = pgEnum('locales', ['en', 'ja'])

export const userBadge = pgEnum('user_badge', [
    'developer',
    'contributor',
    'translator',
    'alpha_tester',
    'shop_owner',
    'patrol',
    'idea_man',
])

export const platform = pgEnum('platform', ['booth', 'github'])

export const itemCategory = pgEnum('item_category', [
    'avatar',
    'clothing',
    'accessory',
    'hair',
    'shader',
    'texture',
    'tool',
    'other',
])

export const userSchema = snakeCase.schema('user')

export const users = userSchema.table(
    'users',
    {
        id: text().primaryKey(),
        name: text().notNull(),
        username: text().unique().notNull(),
        displayUsername: text().notNull(),
        email: text().notNull().unique(),
        emailVerified: boolean().default(false).notNull(),
        image: text(),
        createdAt: timestamp().defaultNow().notNull(),
        updatedAt: timestamp().defaultNow().notNull(),
        role: text(),
        banned: boolean(),
        banReason: text(),
        banExpires: timestamp(),
        bio: text(),
        links: text().array(),
        lastAgreedToTerms: timestamp().defaultNow(),
    },
    (table) => [index('user_email_index').on(table.email)],
)

export const sessions = userSchema.table(
    'sessions',
    {
        id: text().primaryKey(),
        expiresAt: timestamp().notNull(),
        token: text().notNull().unique(),
        createdAt: timestamp().defaultNow().notNull(),
        updatedAt: timestamp()
            .$onUpdate(() => /* @__PURE__ */ new Date())
            .notNull(),
        ipAddress: text(),
        userAgent: text(),
        userId: text().notNull(),
        impersonatedBy: text(),
    },
    (table) => [
        index('session_userId_idx').on(table.userId),
        foreignKey({
            name: 'session_user_id_fkey',
            columns: [table.userId],
            foreignColumns: [users.id],
        }).onDelete('cascade'),
    ],
)

export const accounts = userSchema.table(
    'accounts',
    {
        id: text().primaryKey(),
        accountId: text().notNull(),
        providerId: text().notNull(),
        userId: text()
            .notNull()
            .references(() => users.id, {
                onUpdate: 'cascade',
                onDelete: 'cascade',
            }),
        accessToken: text(),
        refreshToken: text(),
        idToken: text(),
        accessTokenExpiresAt: timestamp(),
        refreshTokenExpiresAt: timestamp(),
        scope: text(),
        password: text(),
        createdAt: timestamp().notNull(),
        updatedAt: timestamp().notNull(),
    },
    (table) => [index('account_user_id_index').on(table.userId)],
)

export const verifications = userSchema.table(
    'verifications',
    {
        id: text().primaryKey(),
        identifier: text().notNull(),
        value: text().notNull(),
        expiresAt: timestamp().notNull(),
        createdAt: timestamp().defaultNow().notNull(),
        updatedAt: timestamp()
            .defaultNow()
            .$onUpdate(() => /* @__PURE__ */ new Date())
            .notNull(),
    },
    (table) => [index('verification_identifier_idx').on(table.identifier)],
)

export const userShops = userSchema.table(
    'user_shops',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        createdAt: timestamp().defaultNow().notNull(),
        userId: text().notNull(),
        shopId: text().notNull(),
    },
    (table) => [
        index('user_shops_user_id_index').on(table.userId),
        index('user_shops_shop_id_index').on(table.shopId),
        foreignKey({
            name: 'user_shops_user_id_fkey',
            columns: [table.userId],
            foreignColumns: [users.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
        foreignKey({
            name: 'user_shops_shop_id_fkey',
            columns: [table.shopId],
            foreignColumns: [shops.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
    ],
)

export const userShopVerifications = userSchema.table(
    'user_shop_verifications',
    {
        id: uuid().primaryKey().defaultRandom(),
        code: text().notNull(),
        createdAt: timestamp().defaultNow().notNull(),
        userId: text().notNull(),
    },
    (table) => [
        index('user_shop_verifications_user_id_index').on(table.userId),
        foreignKey({
            name: 'user_shop_verifications_user_id_fkey',
            columns: [table.userId],
            foreignColumns: [users.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
    ],
)

export const userBadges = userSchema.table(
    'user_badges',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        createdAt: timestamp().defaultNow().notNull(),
        userId: text().notNull(),
        badge: userBadge().notNull(),
    },
    (table) => [
        index('user_badges_user_id_index').on(table.userId),
        foreignKey({
            name: 'user_badges_user_id_fkey',
            columns: [table.userId],
            foreignColumns: [users.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
    ],
)

export const userSettings = userSchema.table(
    'user_settings',
    {
        id: uuid().primaryKey().defaultRandom(),
        createdAt: timestamp().defaultNow().notNull(),
        updatedAt: timestamp()
            .defaultNow()
            .$onUpdate(() => /* @__PURE__ */ new Date())
            .notNull(),
        userId: text().notNull().unique(),
        showPrivateSetups: boolean().default(true).notNull(),
        showNSFW: boolean().default(false).notNull(),
    },
    (table) => [
        index('user_settings_user_id_index').on(table.userId),
        foreignKey({
            name: 'user_settings_user_id_fkey',
            columns: [table.userId],
            foreignColumns: [users.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
    ],
)

export const changelogs = snakeCase.table(
    'changelogs',
    {
        slug: text().primaryKey(),
        createdAt: timestamp().defaultNow().notNull(),
        updatedAt: timestamp()
            .defaultNow()
            .$onUpdate(() => /* @__PURE__ */ new Date())
            .notNull(),
        title: text().notNull(),
        markdown: text().notNull(),
        html: text(),
    },
    (table) => [index('changelogs_slug_index').on(table.slug)],
)

export const changelogI18ns = snakeCase.table(
    'changelog_i18ns',
    {
        id: uuid().primaryKey().defaultRandom(),
        changelogSlug: text().notNull(),
        locale: locales().notNull(),
        title: text().notNull(),
        markdown: text().notNull(),
        html: text(),
        aiGenerated: boolean().default(false).notNull(),
    },
    (table) => [
        index('changelog_i18ns_changelog_slug_index').on(table.changelogSlug),
        index('changelog_i18ns_locale_index').on(table.locale),
        foreignKey({
            name: 'changelog_i18ns_changelog_slug_fkey',
            columns: [table.changelogSlug],
            foreignColumns: [changelogs.slug],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
    ],
)

export const changelogAuthors = snakeCase.table(
    'changelog_authors',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        changelogSlug: text().notNull(),
        userId: text().notNull(),
    },
    (table) => [
        index('changelog_authors_changelog_slug_index').on(table.changelogSlug),
        index('changelog_authors_user_id_index').on(table.userId),
        foreignKey({
            name: 'changelog_authors_changelog_slug_fkey',
            columns: [table.changelogSlug],
            foreignColumns: [changelogs.slug],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
        foreignKey({
            name: 'changelog_authors_user_id_fkey',
            columns: [table.userId],
            foreignColumns: [users.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
    ],
)

export const shops = snakeCase.table(
    'shops',
    {
        id: text().primaryKey(),
        createdAt: timestamp().defaultNow().notNull(),
        updatedAt: timestamp()
            .defaultNow()
            .$onUpdate(() => /* @__PURE__ */ new Date())
            .notNull(),
        platform: platform().notNull(),
        name: text().notNull(),
        image: text(),
        verified: boolean().default(false).notNull(),
    },
    (table) => [index('shops_id_index').on(table.id), index('shops_name_index').on(table.name)],
)

export const items = snakeCase.table(
    'items',
    {
        id: text().primaryKey(),
        createdAt: timestamp().defaultNow().notNull(),
        updatedAt: timestamp()
            .defaultNow()
            .$onUpdate(() => /* @__PURE__ */ new Date())
            .notNull(),
        platform: platform().notNull(),
        outdated: boolean().default(false).notNull(),
        shopId: text(),
        name: text().notNull(),
        niceName: text(),
        category: itemCategory().notNull(),
        image: text(),
        price: text(),
        likes: integer(),
        nsfw: boolean().default(false).notNull(),
    },
    (table) => [
        index('items_id_index').on(table.id),
        index('items_name_index').on(table.name),
        foreignKey({
            name: 'items_shop_id_fkey',
            columns: [table.shopId],
            foreignColumns: [shops.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
    ],
)

export const setups = snakeCase.table(
    'setups',
    {
        id: text()
            .primaryKey()
            .$default(() => nanoid(8)),
        createdAt: timestamp().defaultNow().notNull(),
        updatedAt: timestamp()
            .defaultNow()
            .$onUpdate(() => /* @__PURE__ */ new Date())
            .notNull(),
        userId: text().notNull(),
        public: boolean().default(true).notNull(),
        name: text().notNull(),
        description: text(),
        hidAt: timestamp(),
        hidReason: text(),
    },
    (table) => [
        index('setups_id_index').on(table.id),
        index('setups_user_id_index').on(table.userId),
        index('setups_name_index').on(table.name),
        foreignKey({
            name: 'setups_user_id_fkey',
            columns: [table.userId],
            foreignColumns: [users.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
    ],
)

export const setupItems = snakeCase.table(
    'setup_items',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        itemId: text().notNull(),
        setupId: text().notNull(),
        category: itemCategory(),
        unsupported: boolean().default(false).notNull(),
        note: text(),
    },
    (table) => [
        index('setup_items_id_index').on(table.id),
        index('setup_items_setup_id_index').on(table.setupId),
        foreignKey({
            name: 'setup_items_item_id_fkey',
            columns: [table.itemId],
            foreignColumns: [items.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
        foreignKey({
            name: 'setup_items_setup_id_fkey',
            columns: [table.setupId],
            foreignColumns: [setups.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
    ],
)

export const setupItemShapekeys = snakeCase.table(
    'setup_item_shapekeys',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        setupItemId: integer().notNull(),
        name: text().notNull(),
        value: real().notNull(),
    },
    (table) => [
        index('setup_item_shapekeys_id_index').on(table.id),
        index('setup_item_shapekeys_setup_item_id_index').on(table.setupItemId),
        foreignKey({
            name: 'setup_item_shapekeys_setup_item_id_fkey',
            columns: [table.setupItemId],
            foreignColumns: [setupItems.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
    ],
)

export const setupTags = snakeCase.table(
    'setup_tags',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        setupId: text().notNull(),
        tag: text().notNull(),
    },
    (table) => [
        index('setup_tags_id_index').on(table.id),
        index('setup_tags_setup_id_index').on(table.setupId),
        index('setup_tags_tag_index').on(table.tag),
        foreignKey({
            name: 'setup_tags_setup_id_fkey',
            columns: [table.setupId],
            foreignColumns: [setups.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
    ],
)

export const setupImages = snakeCase.table(
    'setup_images',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        setupId: text().notNull(),
        url: text().notNull(),
        width: integer().notNull(),
        height: integer().notNull(),
        themeColors: text().array(),
    },
    (table) => [
        index('setup_images_id_index').on(table.id),
        index('setup_images_setup_id_index').on(table.setupId),
        foreignKey({
            name: 'setup_images_setup_id_fkey',
            columns: [table.setupId],
            foreignColumns: [setups.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
    ],
)

export const setupCoauthors = snakeCase.table(
    'setup_coauthors',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        setupId: text().notNull(),
        userId: text().notNull(),
        note: text(),
    },
    (table) => [
        index('setup_coauthors_id_index').on(table.id),
        index('setup_coauthors_setup_id_index').on(table.setupId),
        index('setup_coauthors_user_id_index').on(table.userId),
        foreignKey({
            name: 'setup_coauthors_setup_id_fkey',
            columns: [table.setupId],
            foreignColumns: [setups.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
        foreignKey({
            name: 'setup_coauthors_user_id_fkey',
            columns: [table.userId],
            foreignColumns: [users.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
    ],
)

export const followUsers = userSchema.table(
    'follow_users',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        createdAt: timestamp().defaultNow().notNull(),
        userId: text().notNull(),
        targetUserId: text().notNull(),
    },
    (table) => [
        index('follow_users_id_index').on(table.id),
        index('follow_users_user_id_index').on(table.userId),
        index('follow_users_target_user_id_index').on(table.targetUserId),
        foreignKey({
            name: 'follow_users_user_id_fkey',
            columns: [table.userId],
            foreignColumns: [users.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
        foreignKey({
            name: 'follow_users_target_user_id_fkey',
            columns: [table.targetUserId],
            foreignColumns: [users.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
    ],
)

export const setupDrafts = userSchema.table(
    'setup_drafts',
    {
        id: uuid().primaryKey().defaultRandom(),
        createdAt: timestamp().defaultNow().notNull(),
        updatedAt: timestamp()
            .defaultNow()
            .$onUpdate(() => /* @__PURE__ */ new Date())
            .notNull(),
        userId: text().notNull(),
        setupId: text(),
        content: jsonb().notNull(),
    },
    (table) => [
        index('setup_drafts_id_index').on(table.id),
        index('setup_drafts_setup_id_index').on(table.setupId),
        index('setup_drafts_user_id_index').on(table.userId),
        foreignKey({
            name: 'setup_drafts_setup_id_fkey',
            columns: [table.setupId],
            foreignColumns: [setups.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
        foreignKey({
            name: 'setup_drafts_user_id_fkey',
            columns: [table.userId],
            foreignColumns: [users.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
    ],
)

export const setupDraftImages = userSchema.table(
    'setup_draft_images',
    {
        id: uuid().primaryKey().defaultRandom(),
        setupDraftId: uuid().notNull(),
        url: text().notNull(),
    },
    (table) => [
        index('setup_draft_images_id_index').on(table.id),
        index('setup_draft_images_setup_draft_id_index').on(table.setupDraftId),
        index('setup_draft_images_url_index').on(table.url),
        foreignKey({
            name: 'setup_draft_images_setup_draft_id_fkey',
            columns: [table.setupDraftId],
            foreignColumns: [setupDrafts.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
    ],
)

export const bookmarks = userSchema.table(
    'bookmarks',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        createdAt: timestamp().defaultNow().notNull(),
        userId: text().notNull(),
        setupId: text().notNull(),
    },
    (table) => [
        index('bookmarks_id_index').on(table.id),
        index('bookmarks_user_id_index').on(table.userId),
        index('bookmarks_setup_id_index').on(table.setupId),
        foreignKey({
            name: 'bookmarks_user_id_fkey',
            columns: [table.userId],
            foreignColumns: [users.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
        foreignKey({
            name: 'bookmarks_setup_id_fkey',
            columns: [table.setupId],
            foreignColumns: [setups.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
    ],
)

export const notificationType = pgEnum('notification_type', [
    'system_announcement',
    'user_badge_granted',
    'setup_coauthor_added',
    'user_role_changed',
    'user_banned',
    'user_unbanned',
    'user_followed',
    'setup_created',
])

export interface NotificationPayload {
    user?: {
        username: string | null | undefined
        name: string
    }
    setup?: {
        id: number
        name: string
    }
    banExpiresIn?: number
    content?: string
    customTranslations?: {
        [locale: string]: {
            title: string
            message?: string
            actionLabel?: string
        }
    }
}

export const notifications = userSchema.table(
    'notifications',
    {
        id: uuid().primaryKey().defaultRandom(),
        createdAt: timestamp().defaultNow().notNull(),
        userId: text().notNull(),
        type: notificationType().notNull(),
        readAt: timestamp(),
        payload: jsonb().$type<NotificationPayload>().notNull(),
        actionUrl: text(),
        banner: boolean().default(false).notNull(),
    },
    (table) => [
        index('notifications_user_id_index').on(table.userId),
        index('notifications_type_index').on(table.type),
        foreignKey({
            name: 'notifications_user_id_fkey',
            columns: [table.userId],
            foreignColumns: [users.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
    ],
)

export const feedbackSchema = snakeCase.schema('feedback')

export const feedbacks = feedbackSchema.table(
    'feedbacks',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        createdAt: timestamp().defaultNow().notNull(),
        fingerprint: text().notNull(),
        comment: text().notNull(),
        contextPath: text(),
        isClosed: boolean().default(false).notNull(),
    },
    (table) => [
        index('feedbacks_id_index').on(table.id),
        index('feedbacks_fingerprint_index').on(table.fingerprint),
    ],
)

export const itemReports = feedbackSchema.table(
    'item_reports',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        createdAt: timestamp().defaultNow().notNull(),
        reporterId: text().notNull(),
        itemId: text().notNull(),
        nameError: boolean().default(false).notNull(),
        irrelevant: boolean().default(false).notNull(),
        other: boolean().default(false).notNull(),
        comment: text(),
        isResolved: boolean().default(false).notNull(),
    },
    (table) => [
        index('item_reports_id_index').on(table.id),
        index('item_reports_item_id_index').on(table.itemId),
        index('item_reports_reporter_id_index').on(table.reporterId),
        foreignKey({
            name: 'item_reports_reporter_id_fkey',
            columns: [table.reporterId],
            foreignColumns: [users.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
        foreignKey({
            name: 'item_reports_item_id_fkey',
            columns: [table.itemId],
            foreignColumns: [items.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
    ],
)

export const setupReports = feedbackSchema.table(
    'setup_reports',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        createdAt: timestamp().defaultNow().notNull(),
        reporterId: text().notNull(),
        setupId: text().notNull(),
        spam: boolean().default(false).notNull(),
        hate: boolean().default(false).notNull(),
        infringe: boolean().default(false).notNull(),
        badImage: boolean().default(false).notNull(),
        other: boolean().default(false).notNull(),
        comment: text(),
        isResolved: boolean().default(false).notNull(),
    },
    (table) => [
        index('setup_reports_id_index').on(table.id),
        index('setup_reports_setup_id_index').on(table.setupId),
        index('setup_reports_reporter_id_index').on(table.reporterId),
        foreignKey({
            name: 'setup_reports_reporter_id_fkey',
            columns: [table.reporterId],
            foreignColumns: [users.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
        foreignKey({
            name: 'setup_reports_setup_id_fkey',
            columns: [table.setupId],
            foreignColumns: [setups.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
    ],
)

export const userReports = feedbackSchema.table(
    'user_reports',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        createdAt: timestamp().defaultNow().notNull(),
        reporterId: text().notNull(),
        reporteeId: text().notNull(),
        spam: boolean().default(false).notNull(),
        hate: boolean().default(false).notNull(),
        infringe: boolean().default(false).notNull(),
        badImage: boolean().default(false).notNull(),
        other: boolean().default(false).notNull(),
        comment: text(),
        isResolved: boolean().default(false).notNull(),
    },
    (table) => [
        index('user_reports_id_index').on(table.id),
        index('user_reports_reporter_id_index').on(table.reporterId),
        index('user_reports_reportee_id_index').on(table.reporteeId),
        foreignKey({
            name: 'user_reports_reporter_id_fkey',
            columns: [table.reporterId],
            foreignColumns: [users.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
        foreignKey({
            name: 'user_reports_reportee_id_fkey',
            columns: [table.reporteeId],
            foreignColumns: [users.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
    ],
)

export const adminSchema = snakeCase.schema('admin')

export const auditActionType = pgEnum('audit_action_type', [
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
])

export const auditTargetType = pgEnum('audit_target_type', [
    'user',
    'setup',
    'report',
    'feedback',
    'badge',
    'system',
])

export const auditLogs = adminSchema.table(
    'audit_logs',
    {
        id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
        createdAt: timestamp().defaultNow().notNull(),
        userId: text(),
        action: auditActionType().notNull(),
        targetType: auditTargetType().notNull(),
        targetId: text(),
        details: text(),
    },
    (table) => [
        index('audit_logs_created_at_index').on(table.createdAt),
        index('audit_logs_user_id_index').on(table.userId),
        index('audit_logs_action_index').on(table.action),
        index('audit_logs_target_type_index').on(table.targetType),
        index('audit_logs_target_id_index').on(table.targetId),
        foreignKey({
            name: 'audit_logs_user_id_fkey',
            columns: [table.userId],
            foreignColumns: [users.id],
        })
            .onDelete('set null')
            .onUpdate('cascade'),
    ],
)

export const emails = adminSchema.table(
    'emails',
    {
        id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
        messageId: text().notNull(),
        subject: text(),
        fromAddress: text().notNull(),
        fromName: text(),
        toAddress: text().notNull(),
        snippet: text(),
        isRead: boolean().default(false).notNull(),
        isArchived: boolean().default(false).notNull(),
        receivedAt: timestamp().notNull(),
        createdAt: timestamp().defaultNow().notNull(),
        updatedAt: timestamp()
            .$onUpdate(() => /* @__PURE__ */ new Date())
            .notNull(),
    },
    (table) => [
        uniqueIndex('emails_message_id_idx').on(table.messageId),
        index('emails_received_at_idx').on(table.receivedAt),
        index('emails_status_idx').on(table.isRead, table.isArchived),
    ],
)
