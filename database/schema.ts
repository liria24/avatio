import { sql } from 'drizzle-orm'
import {
    foreignKey,
    index,
    integer,
    real,
    snakeCase,
    text,
    uniqueIndex,
} from 'drizzle-orm/sqlite-core'
import { nanoid } from 'nanoid'

const now = sql`(unixepoch() * 1000)`
const timestamp = () => integer({ mode: 'timestamp_ms' })
const boolean = () => integer({ mode: 'boolean' })
const identity = () => integer().primaryKey({ autoIncrement: true })
const uuid = () => text().$defaultFn(() => crypto.randomUUID())
export const locales = ['en', 'ja'] as const
export const userBadge = [
    'developer',
    'contributor',
    'translator',
    'alpha_tester',
    'shop_owner',
    'patrol',
    'idea_man',
] as const
export const platform = ['booth', 'github'] as const
export const itemCategory = [
    'avatar',
    'clothing',
    'accessory',
    'hair',
    'shader',
    'texture',
    'tool',
    'other',
] as const
export const notificationType = [
    'system_announcement',
    'user_badge_granted',
    'setup_coauthor_added',
    'user_role_changed',
    'user_banned',
    'user_unbanned',
    'user_followed',
    'setup_created',
] as const
export const auditActionType = [
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
] as const
export const auditTargetType = [
    'user',
    'setup',
    'report',
    'feedback',
    'badge',
    'system',
    'image',
] as const
export const idempotencyStatus = ['pending', 'completed'] as const

export const idempotencyRequests = snakeCase.table(
    'idempotency_requests',
    {
        id: uuid().primaryKey(),
        createdAt: timestamp().default(now).notNull(),
        updatedAt: timestamp()
            .default(now)
            .$onUpdate(() => new Date())
            .notNull(),
        scope: text().notNull(),
        route: text().notNull(),
        key: text().notNull(),
        requestHash: text().notNull(),
        status: text({ enum: idempotencyStatus }).default('pending').notNull(),
        resourceId: text(),
        response: text({ mode: 'json' }).$type<unknown>(),
        statusCode: integer(),
        leaseExpiresAt: timestamp().notNull(),
        expiresAt: timestamp().notNull(),
    },
    (table) => [
        uniqueIndex('idempotency_requests_scope_route_key_uidx').on(
            table.scope,
            table.route,
            table.key,
        ),
        index('idempotency_requests_expires_at_idx').on(table.expiresAt),
        index('idempotency_requests_status_lease_idx').on(table.status, table.leaseExpiresAt),
    ],
)

export const users = snakeCase.table(
    'users',
    {
        id: text().primaryKey(),
        name: text().notNull(),
        username: text().unique().notNull(),
        displayUsername: text().notNull(),
        email: text().notNull().unique(),
        emailVerified: boolean().default(false).notNull(),
        image: text(),
        createdAt: timestamp().default(now).notNull(),
        updatedAt: timestamp().default(now).notNull(),
        role: text(),
        banned: boolean(),
        banReason: text(),
        banExpires: timestamp(),
        bio: text(),
        links: text({ mode: 'json' }).$type<string[]>(),
        lastAgreedToTerms: timestamp().default(now),
    },
    (table) => [index('user_email_index').on(table.email)],
)

export const sessions = snakeCase.table(
    'sessions',
    {
        id: text().primaryKey(),
        expiresAt: timestamp().notNull(),
        token: text().notNull().unique(),
        createdAt: timestamp().default(now).notNull(),
        updatedAt: timestamp()
            .default(now)
            .$onUpdate(() => new Date())
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

export const accounts = snakeCase.table(
    'accounts',
    {
        id: text().primaryKey(),
        issuer: text().notNull(),
        providerAccountId: text().notNull(),
        providerId: text().notNull(),
        userId: text()
            .notNull()
            .references(() => users.id, { onUpdate: 'cascade', onDelete: 'cascade' }),
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
    (table) => [
        index('account_user_id_index').on(table.userId),
        uniqueIndex('accounts_issuer_providerAccountId_uidx').on(
            table.issuer,
            table.providerAccountId,
        ),
    ],
)

export const verifications = snakeCase.table(
    'verifications',
    {
        id: text().primaryKey(),
        identifier: text().notNull(),
        value: text().notNull(),
        expiresAt: timestamp().notNull(),
        createdAt: timestamp().default(now).notNull(),
        updatedAt: timestamp()
            .default(now)
            .$onUpdate(() => new Date())
            .notNull(),
    },
    (table) => [index('verification_identifier_idx').on(table.identifier)],
)

export const rateLimits = snakeCase.table('rate_limits', {
    id: text().primaryKey(),
    key: text().notNull().unique(),
    count: integer().notNull(),
    lastRequest: integer().notNull(),
})

export const userShops = snakeCase.table(
    'user_shops',
    {
        id: identity(),
        createdAt: timestamp().default(now).notNull(),
        userId: text().notNull(),
        shopId: text().notNull(),
    },
    (table) => [
        index('user_shops_user_id_index').on(table.userId),
        index('user_shops_shop_id_index').on(table.shopId),
        uniqueIndex('user_shops_user_shop_uidx').on(table.userId, table.shopId),
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

export const userShopVerifications = snakeCase.table(
    'user_shop_verifications',
    {
        id: uuid().primaryKey(),
        code: text().notNull(),
        createdAt: timestamp().default(now).notNull(),
        userId: text().notNull(),
    },
    (table) => [
        uniqueIndex('user_shop_verifications_user_id_uidx').on(table.userId),
        foreignKey({
            name: 'user_shop_verifications_user_id_fkey',
            columns: [table.userId],
            foreignColumns: [users.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
    ],
)

export const userBadges = snakeCase.table(
    'user_badges',
    {
        id: identity(),
        createdAt: timestamp().default(now).notNull(),
        userId: text().notNull(),
        badge: text({ enum: userBadge }).notNull(),
    },
    (table) => [
        index('user_badges_user_id_index').on(table.userId),
        uniqueIndex('user_badges_user_badge_uidx').on(table.userId, table.badge),
        foreignKey({
            name: 'user_badges_user_id_fkey',
            columns: [table.userId],
            foreignColumns: [users.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
    ],
)

export const userSettings = snakeCase.table(
    'user_settings',
    {
        id: uuid().primaryKey(),
        createdAt: timestamp().default(now).notNull(),
        updatedAt: timestamp()
            .default(now)
            .$onUpdate(() => new Date())
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
        createdAt: timestamp().default(now).notNull(),
        updatedAt: timestamp()
            .default(now)
            .$onUpdate(() => new Date())
            .notNull(),
        title: text().notNull(),
        markdown: text().notNull(),
        html: text(),
        idempotencyRequestId: text()
            .unique()
            .references(() => idempotencyRequests.id, { onDelete: 'set null' }),
    },
    (table) => [index('changelogs_slug_index').on(table.slug)],
)

export const changelogI18ns = snakeCase.table(
    'changelog_i18ns',
    {
        id: uuid().primaryKey(),
        changelogSlug: text().notNull(),
        locale: text({ enum: locales }).notNull(),
        title: text().notNull(),
        markdown: text().notNull(),
        html: text(),
        aiGenerated: boolean().default(false).notNull(),
    },
    (table) => [
        index('changelog_i18ns_changelog_slug_index').on(table.changelogSlug),
        index('changelog_i18ns_locale_index').on(table.locale),
        uniqueIndex('changelog_i18ns_slug_locale_uidx').on(table.changelogSlug, table.locale),
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
        id: identity(),
        changelogSlug: text().notNull(),
        userId: text().notNull(),
    },
    (table) => [
        index('changelog_authors_changelog_slug_index').on(table.changelogSlug),
        index('changelog_authors_user_id_index').on(table.userId),
        uniqueIndex('changelog_authors_slug_user_uidx').on(table.changelogSlug, table.userId),
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
        createdAt: timestamp().default(now).notNull(),
        updatedAt: timestamp()
            .default(now)
            .$onUpdate(() => new Date())
            .notNull(),
        platform: text({ enum: platform }).notNull(),
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
        createdAt: timestamp().default(now).notNull(),
        updatedAt: timestamp()
            .default(now)
            .$onUpdate(() => new Date())
            .notNull(),
        platform: text({ enum: platform }).notNull(),
        outdated: boolean().default(false).notNull(),
        shopId: text(),
        name: text().notNull(),
        niceName: text(),
        category: text({ enum: itemCategory }).notNull(),
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
            .$defaultFn(() => nanoid(8)),
        createdAt: timestamp().default(now).notNull(),
        updatedAt: timestamp()
            .default(now)
            .$onUpdate(() => new Date())
            .notNull(),
        userId: text().notNull(),
        public: boolean().default(true).notNull(),
        name: text().notNull(),
        description: text(),
        hidAt: timestamp(),
        hidReason: text(),
        idempotencyRequestId: text()
            .unique()
            .references(() => idempotencyRequests.id, { onDelete: 'set null' }),
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
        id: text()
            .primaryKey()
            .$defaultFn(() => nanoid(12)),
        itemId: text().notNull(),
        setupId: text().notNull(),
        category: text({ enum: itemCategory }),
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
        id: identity(),
        setupItemId: text().notNull(),
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
        id: identity(),
        setupId: text().notNull(),
        tag: text().notNull(),
    },
    (table) => [
        index('setup_tags_id_index').on(table.id),
        index('setup_tags_setup_id_index').on(table.setupId),
        index('setup_tags_tag_index').on(table.tag),
        uniqueIndex('setup_tags_setup_tag_uidx').on(table.setupId, table.tag),
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
        id: identity(),
        setupId: text().notNull(),
        objectKey: text().notNull(),
        width: integer().notNull(),
        height: integer().notNull(),
        themeColors: text({ mode: 'json' }).$type<string[]>(),
        contentType: text(),
        size: integer(),
        etag: text(),
        createdAt: timestamp().default(now).notNull(),
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
        id: identity(),
        setupId: text().notNull(),
        userId: text().notNull(),
        note: text(),
    },
    (table) => [
        index('setup_coauthors_id_index').on(table.id),
        index('setup_coauthors_setup_id_index').on(table.setupId),
        index('setup_coauthors_user_id_index').on(table.userId),
        uniqueIndex('setup_coauthors_setup_user_uidx').on(table.setupId, table.userId),
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

export const followUsers = snakeCase.table(
    'follow_users',
    {
        id: identity(),
        createdAt: timestamp().default(now).notNull(),
        userId: text().notNull(),
        targetUserId: text().notNull(),
    },
    (table) => [
        index('follow_users_id_index').on(table.id),
        index('follow_users_user_id_index').on(table.userId),
        index('follow_users_target_user_id_index').on(table.targetUserId),
        uniqueIndex('follow_users_user_target_uidx').on(table.userId, table.targetUserId),
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

export const setupDrafts = snakeCase.table(
    'setup_drafts',
    {
        id: uuid().primaryKey(),
        createdAt: timestamp().default(now).notNull(),
        updatedAt: timestamp()
            .default(now)
            .$onUpdate(() => new Date())
            .notNull(),
        userId: text().notNull(),
        setupId: text(),
        content: text({ mode: 'json' }).notNull(),
        idempotencyRequestId: text()
            .unique()
            .references(() => idempotencyRequests.id, { onDelete: 'set null' }),
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

export const setupDraftImages = snakeCase.table(
    'setup_draft_images',
    {
        id: uuid().primaryKey(),
        setupDraftId: text().notNull(),
        objectKey: text().notNull(),
    },
    (table) => [
        index('setup_draft_images_id_index').on(table.id),
        index('setup_draft_images_setup_draft_id_index').on(table.setupDraftId),
        index('setup_draft_images_object_key_index').on(table.objectKey),
        uniqueIndex('setup_draft_images_draft_object_uidx').on(table.setupDraftId, table.objectKey),
        foreignKey({
            name: 'setup_draft_images_setup_draft_id_fkey',
            columns: [table.setupDraftId],
            foreignColumns: [setupDrafts.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
    ],
)

export const bookmarks = snakeCase.table(
    'bookmarks',
    {
        id: identity(),
        createdAt: timestamp().default(now).notNull(),
        userId: text().notNull(),
        setupId: text().notNull(),
    },
    (table) => [
        index('bookmarks_id_index').on(table.id),
        index('bookmarks_user_id_index').on(table.userId),
        index('bookmarks_setup_id_index').on(table.setupId),
        uniqueIndex('bookmarks_user_setup_uidx').on(table.userId, table.setupId),
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

export interface NotificationPayload {
    user?: { username: string | null | undefined; name: string }
    setup?: { id: string; name: string }
    banExpiresIn?: number
    content?: string
    customTranslations?: {
        [locale: string]: { title: string; message?: string; actionLabel?: string }
    }
}

export const notifications = snakeCase.table(
    'notifications',
    {
        id: uuid().primaryKey(),
        createdAt: timestamp().default(now).notNull(),
        userId: text().notNull(),
        type: text({ enum: notificationType }).notNull(),
        readAt: timestamp(),
        payload: text({ mode: 'json' }).$type<NotificationPayload>().notNull(),
        actionUrl: text(),
        banner: boolean().default(false).notNull(),
        dedupeKey: text(),
    },
    (table) => [
        index('notifications_user_id_index').on(table.userId),
        index('notifications_type_index').on(table.type),
        uniqueIndex('notifications_user_dedupe_uidx').on(table.userId, table.dedupeKey),
        foreignKey({
            name: 'notifications_user_id_fkey',
            columns: [table.userId],
            foreignColumns: [users.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
    ],
)

export const feedbacks = snakeCase.table(
    'feedbacks',
    {
        id: identity(),
        createdAt: timestamp().default(now).notNull(),
        fingerprint: text().notNull(),
        comment: text().notNull(),
        contextPath: text(),
        isClosed: boolean().default(false).notNull(),
        idempotencyRequestId: text()
            .unique()
            .references(() => idempotencyRequests.id, { onDelete: 'set null' }),
    },
    (table) => [
        index('feedbacks_id_index').on(table.id),
        index('feedbacks_fingerprint_index').on(table.fingerprint),
    ],
)

export const itemReports = snakeCase.table(
    'item_reports',
    {
        id: identity(),
        createdAt: timestamp().default(now).notNull(),
        reporterId: text().notNull(),
        itemId: text().notNull(),
        nameError: boolean().default(false).notNull(),
        irrelevant: boolean().default(false).notNull(),
        other: boolean().default(false).notNull(),
        comment: text(),
        isResolved: boolean().default(false).notNull(),
        idempotencyRequestId: text()
            .unique()
            .references(() => idempotencyRequests.id, { onDelete: 'set null' }),
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

export const setupReports = snakeCase.table(
    'setup_reports',
    {
        id: identity(),
        createdAt: timestamp().default(now).notNull(),
        reporterId: text().notNull(),
        setupId: text().notNull(),
        spam: boolean().default(false).notNull(),
        hate: boolean().default(false).notNull(),
        infringe: boolean().default(false).notNull(),
        badImage: boolean().default(false).notNull(),
        other: boolean().default(false).notNull(),
        comment: text(),
        isResolved: boolean().default(false).notNull(),
        idempotencyRequestId: text()
            .unique()
            .references(() => idempotencyRequests.id, { onDelete: 'set null' }),
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

export const userReports = snakeCase.table(
    'user_reports',
    {
        id: identity(),
        createdAt: timestamp().default(now).notNull(),
        reporterId: text().notNull(),
        reporteeId: text().notNull(),
        spam: boolean().default(false).notNull(),
        hate: boolean().default(false).notNull(),
        infringe: boolean().default(false).notNull(),
        badImage: boolean().default(false).notNull(),
        other: boolean().default(false).notNull(),
        comment: text(),
        isResolved: boolean().default(false).notNull(),
        idempotencyRequestId: text()
            .unique()
            .references(() => idempotencyRequests.id, { onDelete: 'set null' }),
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

export interface EmailAttachmentMetadata {
    filename: string | null
    size: number | null
    type: string
    disposition?: 'attachment' | 'inline' | null
    contentId?: string
}

export const auditLogs = snakeCase.table(
    'audit_logs',
    {
        id: identity(),
        createdAt: timestamp().default(now).notNull(),
        userId: text(),
        action: text({ enum: auditActionType }).notNull(),
        targetType: text({ enum: auditTargetType }).notNull(),
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

export const emails = snakeCase.table(
    'emails',
    {
        id: identity(),
        messageId: text().notNull(),
        subject: text(),
        fromAddress: text().notNull(),
        fromName: text(),
        toAddress: text().notNull(),
        snippet: text(),
        textBody: text(),
        htmlBody: text(),
        attachments: text({ mode: 'json' })
            .$type<EmailAttachmentMetadata[]>()
            .default(sql`'[]'`)
            .notNull(),
        rawSize: integer(),
        isRead: boolean().default(false).notNull(),
        isArchived: boolean().default(false).notNull(),
        receivedAt: timestamp().notNull(),
        createdAt: timestamp().default(now).notNull(),
        updatedAt: timestamp()
            .default(now)
            .$onUpdate(() => new Date())
            .notNull(),
    },
    (table) => [
        uniqueIndex('emails_message_id_idx').on(table.messageId),
        index('emails_received_at_idx').on(table.receivedAt),
        index('emails_status_idx').on(table.isRead, table.isArchived),
    ],
)
