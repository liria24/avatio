import { foreignKey, index, integer, snakeCase, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

import { boolean, identity, now, timestamp, uuid } from './columns'

export const userBadge = [
    'developer',
    'contributor',
    'translator',
    'alpha_tester',
    'shop_owner',
    'publisher_owner',
    'patrol',
    'idea_man',
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
        email: text().notNull(),
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
    (table) => [uniqueIndex('user_email_unique').on(table.email)],
)

export const legalAcceptances = snakeCase.table(
    'legal_acceptances',
    {
        id: uuid().primaryKey(),
        userId: text()
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        document: text({ enum: ['terms', 'privacy-policy'] }).notNull(),
        version: text().notNull(),
        sourceRevision: text().notNull(),
        sourceCommit: text(),
        sourceLocale: text().notNull(),
        acceptedAt: timestamp().notNull(),
    },
    (table) => [
        uniqueIndex('legal_acceptances_user_document_version_uidx').on(
            table.userId,
            table.document,
            table.version,
        ),
    ],
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
        uniqueIndex('accounts_providerId_providerAccountId_uidx').on(
            table.providerId,
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
        userId: text().notNull(),
        showPrivateSetups: boolean().default(true).notNull(),
        showNSFW: boolean().default(false).notNull(),
    },
    (table) => [
        uniqueIndex('user_settings_user_id_unique').on(table.userId),
        foreignKey({
            name: 'user_settings_user_id_fkey',
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
