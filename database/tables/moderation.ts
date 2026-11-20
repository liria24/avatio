import { sql } from 'drizzle-orm'
import { foreignKey, index, integer, snakeCase, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

import { idempotencyRequests, users } from './auth'
import { catalogItems } from './catalog'
import { boolean, identity, now, timestamp } from './columns'
import { setups } from './setups'

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
        catalogItemId: text()
            .notNull()
            .references(() => catalogItems.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
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
        index('item_reports_catalog_item_id_index').on(table.catalogItemId),
        index('item_reports_reporter_id_index').on(table.reporterId),
        foreignKey({
            name: 'item_reports_reporter_id_fkey',
            columns: [table.reporterId],
            foreignColumns: [users.id],
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
