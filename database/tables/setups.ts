import { itemCategories } from '@avatio/core/catalog'
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

import { idempotencyRequests, users } from './auth'
import { catalogItems } from './catalog'
import { boolean, identity, now, timestamp, uuid } from './columns'

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

/** V2 Setup relation. Source withdrawal never deletes this relation. */
export const setupEntries = snakeCase.table(
    'setup_entries',
    {
        id: text().primaryKey(),
        itemId: text().notNull(),
        setupId: text().notNull(),
        position: integer().default(0).notNull(),
        categoryOverride: text({ enum: itemCategories }),
        unsupported: boolean().default(false).notNull(),
        note: text(),
    },
    (table) => [
        index('setup_entries_setup_id_idx').on(table.setupId),
        index('setup_entries_item_id_idx').on(table.itemId),
        foreignKey({
            name: 'setup_entries_item_id_fkey',
            columns: [table.itemId],
            foreignColumns: [catalogItems.id],
        })
            .onDelete('restrict')
            .onUpdate('cascade'),
        foreignKey({
            name: 'setup_entries_setup_id_fkey',
            columns: [table.setupId],
            foreignColumns: [setups.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
    ],
)

export const setupEntryShapekeys = snakeCase.table(
    'setup_entry_shapekeys',
    {
        id: identity(),
        setupEntryId: text().notNull(),
        name: text().notNull(),
        value: real().notNull(),
    },
    (table) => [
        index('setup_entry_shapekeys_entry_id_idx').on(table.setupEntryId),
        foreignKey({
            name: 'setup_entry_shapekeys_entry_id_fkey',
            columns: [table.setupEntryId],
            foreignColumns: [setupEntries.id],
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
        stableId: text().notNull().unique(),
        setupId: text().notNull(),
        position: integer().default(0).notNull(),
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

export const setupImagePoints = snakeCase.table(
    'setup_image_points',
    {
        id: text().primaryKey(),
        setupId: text().notNull(),
        imageId: text().notNull(),
        setupEntryId: text().notNull(),
        x: real().notNull(),
        y: real().notNull(),
    },
    (table) => [
        index('setup_image_points_setup_id_idx').on(table.setupId),
        index('setup_image_points_image_id_idx').on(table.imageId),
        index('setup_image_points_entry_id_idx').on(table.setupEntryId),
        foreignKey({
            name: 'setup_image_points_setup_id_fkey',
            columns: [table.setupId],
            foreignColumns: [setups.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
        foreignKey({
            name: 'setup_image_points_entry_id_fkey',
            columns: [table.setupEntryId],
            foreignColumns: [setupEntries.id],
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
        revision: integer().default(1).notNull(),
        content: text({ mode: 'json' }).notNull(),
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
