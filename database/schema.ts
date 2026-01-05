import {
    bigint,
    boolean,
    foreignKey,
    index,
    integer,
    jsonb,
    pgEnum,
    pgSchema,
    pgTable,
    real,
    text,
    timestamp,
    uuid,
} from 'drizzle-orm/pg-core'

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

export const authSchema = pgSchema('auth')

export const user = authSchema.table(
    'user',
    {
        id: text().primaryKey(),
        name: text().notNull(),
        username: text().unique().notNull(),
        displayUsername: text('display_username').notNull(),
        email: text().notNull().unique(),
        emailVerified: boolean('email_verified').default(false).notNull(),
        image: text(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
        role: text(),
        banned: boolean(),
        banReason: text('ban_reason'),
        banExpires: timestamp('ban_expires'),
        bio: text(),
        links: text().array(),
        isInitialized: boolean('is_initialized').notNull().default(false),
    },
    (table) => [index('user_email_index').on(table.email)]
)

export const session = authSchema.table(
    'session',
    {
        id: text().primaryKey(),
        expiresAt: timestamp('expires_at').notNull(),
        token: text().notNull().unique(),
        createdAt: timestamp('created_at').notNull(),
        updatedAt: timestamp('updated_at').notNull(),
        ipAddress: text('ip_address'),
        userAgent: text('user_agent'),
        userId: text('user_id')
            .notNull()
            .references(() => user.id, {
                onUpdate: 'cascade',
                onDelete: 'cascade',
            }),
        impersonatedBy: text('impersonated_by'),
    },
    (table) => [
        index('session_user_id_index').on(table.userId),
        index('session_expires_at_index').on(table.expiresAt),
        index('session_token_index').on(table.token),
    ]
)

export const account = authSchema.table(
    'account',
    {
        id: text().primaryKey(),
        accountId: text('account_id').notNull(),
        providerId: text('provider_id').notNull(),
        userId: text('user_id')
            .notNull()
            .references(() => user.id, {
                onUpdate: 'cascade',
                onDelete: 'cascade',
            }),
        accessToken: text('access_token'),
        refreshToken: text('refresh_token'),
        idToken: text('id_token'),
        accessTokenExpiresAt: timestamp('access_token_expires_at'),
        refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
        scope: text(),
        password: text(),
        createdAt: timestamp('created_at').notNull(),
        updatedAt: timestamp('updated_at').notNull(),
    },
    (table) => [index('account_user_id_index').on(table.userId)]
)

export const verification = authSchema.table(
    'verification',
    {
        id: text().primaryKey(),
        identifier: text().notNull(),
        value: text().notNull(),
        expiresAt: timestamp('expires_at').notNull(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
    },
    (table) => [index('verification_identifier_index').on(table.identifier)]
)

export const userShops = authSchema.table(
    'user_shops',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        userId: text('user_id').notNull(),
        shopId: text('shop_id').notNull(),
    },
    (table) => [
        index('user_shops_user_id_index').on(table.userId),
        index('user_shops_shop_id_index').on(table.shopId),
        foreignKey({
            name: 'user_shops_user_id_fkey',
            columns: [table.userId],
            foreignColumns: [user.id],
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
    ]
)

export const userShopVerification = authSchema.table(
    'user_shop_verification',
    {
        id: uuid().primaryKey().defaultRandom(),
        code: text().notNull(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        userId: text('user_id').notNull(),
    },
    (table) => [
        index('user_shop_verification_user_id_index').on(table.userId),
        foreignKey({
            name: 'user_shop_verification_user_id_fkey',
            columns: [table.userId],
            foreignColumns: [user.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
    ]
)

export const userBadges = authSchema.table(
    'user_badges',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        userId: text('user_id').notNull(),
        badge: userBadge().notNull(),
    },
    (table) => [
        index('user_badges_user_id_index').on(table.userId),
        foreignKey({
            name: 'user_badges_user_id_fkey',
            columns: [table.userId],
            foreignColumns: [user.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
    ]
)

export const changelogs = pgTable(
    'changelogs',
    {
        slug: text().primaryKey(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
        title: text().notNull(),
        markdown: text().notNull(),
        html: text().notNull(),
    },
    (table) => [index('changelogs_slug_index').on(table.slug)]
)

export const changelogAuthors = pgTable(
    'changelog_authors',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        changelogSlug: text('changelog_slug').notNull(),
        userId: text('user_id').notNull(),
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
            foreignColumns: [user.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
    ]
)

export const shops = pgTable(
    'shops',
    {
        id: text().primaryKey(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
        platform: platform().notNull(),
        name: text().notNull(),
        image: text(),
        verified: boolean().default(false).notNull(),
    },
    (table) => [
        index('shops_id_index').on(table.id),
        index('shops_name_index').on(table.name),
    ]
)

export const items = pgTable(
    'items',
    {
        id: text().primaryKey(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
        platform: platform().notNull(),
        outdated: boolean().default(false).notNull(),
        shopId: text('shop_id'),
        name: text().notNull(),
        niceName: text('nice_name'),
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
    ]
)

export const setups = pgTable(
    'setups',
    {
        id: integer().primaryKey().generatedByDefaultAsIdentity(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
        userId: text('user_id').notNull(),
        name: text().notNull(),
        description: text(),
        hidAt: timestamp('hid_at'),
        hidReason: text('hid_reason'),
    },
    (table) => [
        index('setups_id_index').on(table.id),
        index('setups_user_id_index').on(table.userId),
        index('setups_name_index').on(table.name),
        foreignKey({
            name: 'setups_user_id_fkey',
            columns: [table.userId],
            foreignColumns: [user.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
    ]
)

export const setupItems = pgTable(
    'setup_items',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        itemId: text('item_id').notNull(),
        setupId: integer('setup_id').notNull(),
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
    ]
)

export const setupItemShapekeys = pgTable(
    'setup_item_shapekeys',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        setupItemId: integer('setup_item_id').notNull(),
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
    ]
)

export const setupTags = pgTable(
    'setup_tags',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        setupId: integer('setup_id').notNull(),
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
    ]
)

export const setupImages = pgTable(
    'setup_images',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        setupId: integer('setup_id').notNull(),
        url: text().notNull(),
        width: integer().notNull(),
        height: integer().notNull(),
        themeColors: text('theme_colors').array(),
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
    ]
)

export const setupCoauthors = pgTable(
    'setup_coauthors',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        setupId: integer('setup_id').notNull(),
        userId: text('user_id').notNull(),
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
            foreignColumns: [user.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
    ]
)

export const personalSchema = pgSchema('personal')

export const followUsers = personalSchema.table(
    'follow_users',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        userId: text('user_id').notNull(),
        targetUserId: text('target_user_id').notNull(),
    },
    (table) => [
        index('follow_users_id_index').on(table.id),
        index('follow_users_user_id_index').on(table.userId),
        index('follow_users_target_user_id_index').on(table.targetUserId),
        foreignKey({
            name: 'follow_users_user_id_fkey',
            columns: [table.userId],
            foreignColumns: [user.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
        foreignKey({
            name: 'follow_users_target_user_id_fkey',
            columns: [table.targetUserId],
            foreignColumns: [user.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
    ]
)

export const setupDrafts = personalSchema.table(
    'setup_drafts',
    {
        id: uuid().primaryKey().defaultRandom(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
        userId: text('user_id').notNull(),
        setupId: integer('setup_id'),
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
            foreignColumns: [user.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
    ]
)

export const setupDraftImages = personalSchema.table(
    'setup_draft_images',
    {
        id: uuid().primaryKey().defaultRandom(),
        setupDraftId: uuid('setup_draft_id').notNull(),
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
    ]
)

export const bookmarks = personalSchema.table(
    'bookmarks',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        userId: text('user_id').notNull(),
        setupId: integer('setup_id').notNull(),
    },
    (table) => [
        index('bookmarks_id_index').on(table.id),
        index('bookmarks_user_id_index').on(table.userId),
        index('bookmarks_setup_id_index').on(table.setupId),
        foreignKey({
            name: 'bookmarks_user_id_fkey',
            columns: [table.userId],
            foreignColumns: [user.id],
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
    ]
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

export const notifications = personalSchema.table(
    'notifications',
    {
        id: uuid().primaryKey().defaultRandom(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        userId: text('user_id').notNull(),
        type: notificationType().notNull(),
        readAt: timestamp('read_at'),
        title: text().notNull(),
        message: text(),
        data: text(),
        actionUrl: text('action_url'),
        actionLabel: text('action_label'),
        banner: boolean().default(false).notNull(),
    },
    (table) => [
        index('notifications_user_id_index').on(table.userId),
        index('notifications_type_index').on(table.type),
        foreignKey({
            name: 'notifications_user_id_fkey',
            columns: [table.userId],
            foreignColumns: [user.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
    ]
)

export const feedbackSchema = pgSchema('feedback')

export const feedbacks = feedbackSchema.table(
    'feedbacks',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        fingerprint: text().notNull(),
        comment: text().notNull(),
        contextPath: text('context_path'),
        isClosed: boolean('is_closed').default(false).notNull(),
    },
    (table) => [
        index('feedbacks_id_index').on(table.id),
        index('feedbacks_fingerprint_index').on(table.fingerprint),
    ]
)

export const itemReports = feedbackSchema.table(
    'item_reports',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        reporterId: text('reporter_id').notNull(),
        itemId: text('item_id').notNull(),
        nameError: boolean('name_error').default(false).notNull(),
        irrelevant: boolean().default(false).notNull(),
        other: boolean().default(false).notNull(),
        comment: text(),
        isResolved: boolean('is_resolved').default(false).notNull(),
    },
    (table) => [
        index('item_reports_id_index').on(table.id),
        index('item_reports_item_id_index').on(table.itemId),
        index('item_reports_reporter_id_index').on(table.reporterId),
        foreignKey({
            name: 'item_reports_reporter_id_fkey',
            columns: [table.reporterId],
            foreignColumns: [user.id],
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
    ]
)

export const setupReports = feedbackSchema.table(
    'setup_reports',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        reporterId: text('reporter_id').notNull(),
        setupId: integer('setup_id').notNull(),
        spam: boolean().default(false).notNull(),
        hate: boolean().default(false).notNull(),
        infringe: boolean().default(false).notNull(),
        badImage: boolean('bad_image').default(false).notNull(),
        other: boolean().default(false).notNull(),
        comment: text(),
        isResolved: boolean('is_resolved').default(false).notNull(),
    },
    (table) => [
        index('setup_reports_id_index').on(table.id),
        index('setup_reports_setup_id_index').on(table.setupId),
        index('setup_reports_reporter_id_index').on(table.reporterId),
        foreignKey({
            name: 'setup_reports_reporter_id_fkey',
            columns: [table.reporterId],
            foreignColumns: [user.id],
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
    ]
)

export const userReports = feedbackSchema.table(
    'user_reports',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        reporterId: text('reporter_id').notNull(),
        reporteeId: text('reportee_id').notNull(),
        spam: boolean().default(false).notNull(),
        hate: boolean().default(false).notNull(),
        infringe: boolean().default(false).notNull(),
        badImage: boolean('bad_image').default(false).notNull(),
        other: boolean().default(false).notNull(),
        comment: text(),
        isResolved: boolean('is_resolved').default(false).notNull(),
    },
    (table) => [
        index('user_reports_id_index').on(table.id),
        index('user_reports_reporter_id_index').on(table.reporterId),
        index('user_reports_reportee_id_index').on(table.reporteeId),
        foreignKey({
            name: 'user_reports_reporter_id_fkey',
            columns: [table.reporterId],
            foreignColumns: [user.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
        foreignKey({
            name: 'user_reports_reportee_id_fkey',
            columns: [table.reporteeId],
            foreignColumns: [user.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
    ]
)

export const adminSchema = pgSchema('admin')

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
        createdAt: timestamp('created_at').defaultNow().notNull(),
        userId: text('user_id'),
        action: auditActionType().notNull(),
        targetType: auditTargetType().notNull(),
        targetId: text('target_id'),
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
            foreignColumns: [user.id],
        })
            .onDelete('set null')
            .onUpdate('cascade'),
    ]
)
