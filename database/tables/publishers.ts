import { foreignKey, index, snakeCase, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

import { users } from './auth'
import { boolean, now, timestamp, uuid } from './columns'

/** Avatio-owned publisher identity, independent from a provider account. */
export const publishers = snakeCase.table(
    'publishers',
    {
        id: uuid().primaryKey(),
        createdAt: timestamp().default(now).notNull(),
        updatedAt: timestamp()
            .default(now)
            .$onUpdate(() => new Date())
            .notNull(),
        displayNameOverride: text(),
        imageOverride: text(),
    },
    (table) => [index('publishers_display_name_override_idx').on(table.displayNameOverride)],
)

/** Provider-specific publisher identity and snapshot. Provider keys intentionally have no enum. */
export const publisherSources = snakeCase.table(
    'publisher_sources',
    {
        id: uuid().primaryKey(),
        createdAt: timestamp().default(now).notNull(),
        updatedAt: timestamp()
            .default(now)
            .$onUpdate(() => new Date())
            .notNull(),
        publisherId: text().notNull(),
        providerKey: text().notNull(),
        externalId: text().notNull(),
        canonicalUrl: text().notNull(),
        name: text().notNull(),
        image: text(),
        providerVerified: boolean().default(false).notNull(),
        metadata: text({ mode: 'json' }).$type<Record<string, unknown>>(),
    },
    (table) => [
        index('publisher_sources_publisher_id_idx').on(table.publisherId),
        uniqueIndex('publisher_sources_provider_external_uidx').on(
            table.providerKey,
            table.externalId,
        ),
        foreignKey({
            name: 'publisher_sources_publisher_id_fkey',
            columns: [table.publisherId],
            foreignColumns: [publishers.id],
        })
            .onDelete('restrict')
            .onUpdate('cascade'),
    ],
)

/** Verified Avatio ownership of a Publisher. */
export const userPublishers = snakeCase.table(
    'user_publishers',
    {
        id: uuid().primaryKey(),
        createdAt: timestamp().default(now).notNull(),
        userId: text().notNull(),
        publisherId: text().notNull(),
    },
    (table) => [
        index('user_publishers_user_id_idx').on(table.userId),
        index('user_publishers_publisher_id_idx').on(table.publisherId),
        uniqueIndex('user_publishers_user_publisher_uidx').on(table.userId, table.publisherId),
        foreignKey({
            name: 'user_publishers_user_id_fkey',
            columns: [table.userId],
            foreignColumns: [users.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
        foreignKey({
            name: 'user_publishers_publisher_id_fkey',
            columns: [table.publisherId],
            foreignColumns: [publishers.id],
        })
            .onDelete('restrict')
            .onUpdate('cascade'),
    ],
)

/** Authorization truth for ownership of one provider-specific PublisherSource. */
export const publisherSourceOwnerships = snakeCase.table(
    'publisher_source_ownerships',
    {
        id: uuid().primaryKey(),
        userId: text().notNull(),
        publisherSourceId: text().notNull(),
        method: text().notNull(),
        verifiedAt: timestamp().notNull(),
    },
    (table) => [
        index('publisher_source_ownerships_user_id_idx').on(table.userId),
        index('publisher_source_ownerships_source_id_idx').on(table.publisherSourceId),
        uniqueIndex('publisher_source_ownerships_user_source_uidx').on(
            table.userId,
            table.publisherSourceId,
        ),
        foreignKey({
            name: 'publisher_source_ownerships_user_id_fkey',
            columns: [table.userId],
            foreignColumns: [users.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
        foreignKey({
            name: 'publisher_source_ownerships_source_id_fkey',
            columns: [table.publisherSourceId],
            foreignColumns: [publisherSources.id],
        })
            .onDelete('restrict')
            .onUpdate('cascade'),
    ],
)

/** Pending ownership challenge; kept separate from identity and provider state. */
export const publisherVerificationChallenges = snakeCase.table(
    'publisher_source_verification_challenges',
    {
        id: uuid().primaryKey(),
        code: text().notNull(),
        createdAt: timestamp().default(now).notNull(),
        userId: text().notNull(),
        publisherSourceId: text().notNull(),
        method: text().notNull(),
        expiresAt: timestamp().notNull(),
    },
    (table) => [
        index('publisher_verification_challenges_user_id_idx').on(table.userId),
        index('publisher_verification_challenges_source_id_idx').on(table.publisherSourceId),
        index('publisher_verification_challenges_expires_at_idx').on(table.expiresAt),
        foreignKey({
            name: 'publisher_verification_challenges_user_id_fkey',
            columns: [table.userId],
            foreignColumns: [users.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
        foreignKey({
            name: 'publisher_verification_challenges_source_id_fkey',
            columns: [table.publisherSourceId],
            foreignColumns: [publisherSources.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
    ],
)
