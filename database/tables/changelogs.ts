import { foreignKey, index, snakeCase, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

import { idempotencyRequests, users } from './auth'
import { boolean, identity, now, timestamp, uuid } from './columns'

export const locales = ['en', 'ja'] as const

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
