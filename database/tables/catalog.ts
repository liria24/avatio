import {
    catalogClassificationChoices,
    catalogClassificationStatuses,
    categoryOverrideOrigins,
    itemCategories,
    providerAdmissionDecisions,
    sourceAvailabilities,
    syncStates,
} from '@avatio/core/catalog'
import { sql } from 'drizzle-orm'
import {
    foreignKey,
    index,
    integer,
    primaryKey,
    real,
    snakeCase,
    text,
    uniqueIndex,
} from 'drizzle-orm/sqlite-core'

import { boolean, now, timestamp, uuid } from './columns'
import { publisherSources } from './publishers'

/** Provider-owned values surfaced for generic admission management. */
export const providerAdmissionOptions = snakeCase.table(
    'provider_admission_options',
    {
        providerKey: text().notNull(),
        facetKey: text().notNull(),
        valueKey: text().notNull(),
        label: text().notNull(),
        firstSeenAt: timestamp().default(now).notNull(),
        lastSeenAt: timestamp().default(now).notNull(),
    },
    (table) => [
        primaryKey({ columns: [table.providerKey, table.facetKey, table.valueKey] }),
        index('provider_admission_options_provider_facet_idx').on(
            table.providerKey,
            table.facetKey,
        ),
    ],
)

/** Provider-neutral admission decisions. Missing rules are denied. */
export const providerAdmissionRules = snakeCase.table(
    'provider_admission_rules',
    {
        providerKey: text().notNull(),
        facetKey: text().notNull(),
        valueKey: text().notNull(),
        decision: text({ enum: providerAdmissionDecisions }).notNull(),
    },
    (table) => [
        primaryKey({ columns: [table.providerKey, table.facetKey, table.valueKey] }),
        foreignKey({
            name: 'provider_admission_rules_option_fkey',
            columns: [table.providerKey, table.facetKey, table.valueKey],
            foreignColumns: [
                providerAdmissionOptions.providerKey,
                providerAdmissionOptions.facetKey,
                providerAdmissionOptions.valueKey,
            ],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
    ],
)

/** Stable Avatio catalog identity, independent from every provider external ID. */
export const catalogItems = snakeCase.table(
    'catalog_items',
    {
        id: uuid().primaryKey(),
        createdAt: timestamp().default(now).notNull(),
        updatedAt: timestamp()
            .default(now)
            .$onUpdate(() => new Date())
            .notNull(),
        displayNameOverride: text(),
        categoryOverride: text({ enum: itemCategories }),
        categoryOverrideOrigin: text({ enum: categoryOverrideOrigins }),
    },
    (table) => [index('catalog_items_display_name_override_idx').on(table.displayNameOverride)],
)

/** Provider source, provider snapshot, availability, and synchronization state. */
export const itemSources = snakeCase.table(
    'item_sources',
    {
        id: uuid().primaryKey(),
        createdAt: timestamp().default(now).notNull(),
        updatedAt: timestamp()
            .default(now)
            .$onUpdate(() => new Date())
            .notNull(),
        itemId: text().notNull(),
        publisherSourceId: text(),
        providerKey: text().notNull(),
        externalId: text().notNull(),
        canonicalUrl: text().notNull(),
        primary: boolean().default(false).notNull(),
        availability: text({ enum: sourceAvailabilities }).default('unknown').notNull(),
        syncState: text({ enum: syncStates }).default('stale').notNull(),
        providerCategoryKey: text(),
        providerCategoryLabel: text(),
        mappedCategory: text({ enum: itemCategories }),
        displayName: text().notNull(),
        image: text(),
        price: text(),
        popularityCount: integer(),
        nsfw: boolean().default(false).notNull(),
        metadata: text({ mode: 'json' }).$type<Record<string, unknown>>(),
        lastCheckedAt: timestamp(),
        lastSuccessfulSyncAt: timestamp(),
        nextCheckAt: timestamp(),
        syncLeaseUntil: timestamp(),
        syncLeaseToken: text(),
        lastErrorKind: text(),
        lastErrorAt: timestamp(),
    },
    (table) => [
        index('item_sources_item_id_idx').on(table.itemId),
        index('item_sources_publisher_source_id_idx').on(table.publisherSourceId),
        index('item_sources_due_lease_idx').on(table.nextCheckAt, table.syncLeaseUntil),
        uniqueIndex('item_sources_provider_external_uidx').on(table.providerKey, table.externalId),
        uniqueIndex('item_sources_primary_item_uidx')
            .on(table.itemId)
            .where(sql`${table.primary} = 1`),
        foreignKey({
            name: 'item_sources_item_id_fkey',
            columns: [table.itemId],
            foreignColumns: [catalogItems.id],
        })
            .onDelete('restrict')
            .onUpdate('cascade'),
        foreignKey({
            name: 'item_sources_publisher_source_id_fkey',
            columns: [table.publisherSourceId],
            foreignColumns: [publisherSources.id],
        })
            .onDelete('set null')
            .onUpdate('cascade'),
    ],
)

/** Latest Jev classification for a catalog item and source snapshot. */
export const catalogItemClassifications = snakeCase.table(
    'catalog_item_classifications',
    {
        itemId: text().primaryKey(),
        sourceId: text().notNull(),
        sourceUpdatedAt: timestamp().notNull(),
        inputHash: text().notNull(),
        classifierVersion: text().notNull(),
        requestedModel: text().notNull(),
        responseModel: text(),
        status: text({ enum: catalogClassificationStatuses }).default('processing').notNull(),
        category: text({ enum: catalogClassificationChoices }),
        confidence: real(),
        probabilities: text({ mode: 'json' }).$type<Record<string, number>>(),
        errorKind: text(),
        retryAt: timestamp(),
        leaseToken: text(),
        leaseUntil: timestamp(),
        createdAt: timestamp().default(now).notNull(),
        updatedAt: timestamp()
            .default(now)
            .$onUpdate(() => new Date())
            .notNull(),
    },
    (table) => [
        index('catalog_item_classifications_source_id_idx').on(table.sourceId),
        foreignKey({
            name: 'catalog_item_classifications_item_id_fkey',
            columns: [table.itemId],
            foreignColumns: [catalogItems.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
        foreignKey({
            name: 'catalog_item_classifications_source_id_fkey',
            columns: [table.sourceId],
            foreignColumns: [itemSources.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
    ],
)
