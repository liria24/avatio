import {
    catalogItems,
    catalogMigrationRuns,
    itemCategoryOverrides,
    items,
    itemSources,
    publisherSourceOwnerships,
    publisherSources,
    publishers,
    setupEntries,
    setupEntryShapekeys,
    setupItems,
    setupItemShapekeys,
    setups,
    shops,
    userPublishers,
    userShops,
} from '@@/database/schema'
import { and, count, eq, gt, isNull, lte, or, sql } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import type { AppDatabase } from '~~/server/utils/database'
import { executeD1Batch } from '~~/server/utils/executeD1Batch'

import {
    legacyItemCanonicalUrl,
    legacyPublisherCanonicalUrl,
    migrateLegacyItemState,
    migrateLegacySetupEntry,
    migrateLegacyShapekey,
} from './legacy'

export const CATALOG_MIGRATION_ID = 'catalog-v2'
export const CATALOG_MIGRATION_CHUNK_SIZE = 20
const stages = [
    'publishers',
    'catalog',
    'ownerships',
    'setup-entries',
    'shapekeys',
    'verification',
] as const
type Run = typeof catalogMigrationRuns.$inferSelect
type Statement = BatchItem<'sqlite'>

export const getCatalogMigrationRun = async (db: AppDatabase) =>
    (
        await db
            .select()
            .from(catalogMigrationRuns)
            .where(eq(catalogMigrationRuns.id, CATALOG_MIGRATION_ID))
            .limit(1)
    )[0] ?? null

// Aggregate in D1; only bounded diagnostic samples cross the Worker boundary.
const inspect = async (db: AppDatabase, mode: 'dry-run' | 'verification') => {
    const checks = [
        {
            name: 'publishers',
            table: shops,
            missing: sql`NOT EXISTS (SELECT 1 FROM publisher_sources p WHERE p.provider_key = ${shops.platform} AND p.external_id = ${shops.id})`,
        },
        {
            name: 'catalogItems',
            table: items,
            missing: sql`NOT EXISTS (SELECT 1 FROM item_sources s WHERE s.provider_key = ${items.platform} AND s.external_id = ${items.id})`,
        },
        {
            name: 'userPublishers',
            table: userShops,
            missing: sql`NOT EXISTS (SELECT 1 FROM shops s JOIN publisher_sources p ON p.provider_key = s.platform AND p.external_id = s.id JOIN user_publishers u ON u.publisher_id = p.publisher_id AND u.user_id = ${userShops.userId} WHERE s.id = ${userShops.shopId})`,
        },
        {
            name: 'publisherSourceOwnerships',
            table: userShops,
            missing: sql`NOT EXISTS (SELECT 1 FROM shops s JOIN publisher_sources p ON p.provider_key = s.platform AND p.external_id = s.id JOIN publisher_source_ownerships u ON u.publisher_source_id = p.id AND u.user_id = ${userShops.userId} WHERE s.id = ${userShops.shopId})`,
        },
        {
            name: 'setupEntries',
            table: setupItems,
            missing: sql`NOT EXISTS (SELECT 1 FROM setup_entries e WHERE e.id = ${setupItems.id})`,
        },
        {
            name: 'shapekeys',
            table: setupItemShapekeys,
            missing: sql`NOT EXISTS (SELECT 1 FROM setup_entry_shapekeys s WHERE s.id = ${setupItemShapekeys.id})`,
        },
    ] as const
    const pending: Record<string, number> = {}
    const expected: Record<string, number> = {}
    for (const check of checks) {
        const [total] = await db.select({ count: count() }).from(check.table)
        const [missing] = await db.select({ count: count() }).from(check.table).where(check.missing)
        expected[check.name] = total!.count
        pending[check.name] = missing!.count
    }
    const invalidChecks = [
        {
            kind: 'publisher-reference',
            table: items,
            id: items.id,
            condition: sql`${items.shopId} IS NOT NULL AND NOT EXISTS (SELECT 1 FROM shops s WHERE s.id = ${items.shopId} AND s.platform = ${items.platform})`,
        },
        {
            kind: 'catalog-identity',
            table: itemSources,
            id: itemSources.id,
            condition: eq(itemSources.itemId, itemSources.externalId),
        },
        {
            kind: 'availability',
            table: itemSources,
            id: itemSources.id,
            condition: and(
                eq(itemSources.availability, 'withdrawn'),
                eq(itemSources.lastErrorKind, 'legacy-unconfirmed-outdated'),
            ),
        },
        {
            kind: 'setup-entry',
            table: setupItems,
            id: setupItems.id,
            condition: sql`NOT EXISTS (SELECT 1 FROM items i WHERE i.id = ${setupItems.itemId}) OR EXISTS (SELECT 1 FROM setup_entries e WHERE e.id = ${setupItems.id} AND (e.setup_id IS NOT ${setupItems.setupId} OR e.note IS NOT ${setupItems.note} OR e.category_override IS NOT ${setupItems.category} OR e.unsupported IS NOT ${setupItems.unsupported} OR NOT EXISTS (SELECT 1 FROM items i JOIN item_sources s ON s.external_id = i.id AND s.provider_key = i.platform WHERE i.id = ${setupItems.itemId} AND s.item_id = e.item_id)))`,
        },
        {
            kind: 'shapekey',
            table: setupItemShapekeys,
            id: setupItemShapekeys.id,
            condition: sql`NOT EXISTS (SELECT 1 FROM setup_items e WHERE e.id = ${setupItemShapekeys.setupItemId}) OR EXISTS (SELECT 1 FROM setup_entry_shapekeys s WHERE s.id = ${setupItemShapekeys.id} AND (s.setup_entry_id IS NOT ${setupItemShapekeys.setupItemId} OR s.name IS NOT ${setupItemShapekeys.name} OR s.value IS NOT ${setupItemShapekeys.value}))`,
        },
    ] as const
    const issues: {
        severity: 'error' | 'warning'
        kind: string
        legacyId: string
        reason: string
    }[] = []
    let errorCount = 0
    for (const check of invalidChecks) {
        const [total] = await db.select({ count: count() }).from(check.table).where(check.condition)
        errorCount += total!.count
        if (issues.length >= 100) continue
        const sample = await db
            .select({ id: check.id })
            .from(check.table)
            .where(check.condition)
            .limit(100 - issues.length)
        issues.push(
            ...sample.map((row) => ({
                severity: 'error' as const,
                kind: check.kind,
                legacyId: String(row.id),
                reason: 'Legacy and v2 mapping is inconsistent.',
            })),
        )
    }
    const unusualIds = await db
        .select({ id: setups.id })
        .from(setups)
        .where(sql`length(${setups.id}) != 8 OR ${setups.id} GLOB '*[^A-Za-z0-9_-]*'`)
        .limit(Math.max(0, 100 - issues.length))
    issues.push(
        ...unusualIds.map(({ id }) => ({
            severity: 'warning' as const,
            kind: 'setup-id-shape',
            legacyId: id,
            reason: 'Preflight this existing route; preserve its ID.',
        })),
    )
    return {
        mode,
        pending,
        expected,
        issues,
        errorCount,
        verified: errorCount === 0 && Object.values(pending).every((value) => value === 0),
    }
}

export const inspectCatalogV2Backfill = (db: AppDatabase) => inspect(db, 'dry-run')

export const verifyCatalogV2Backfill = async (db: AppDatabase) => {
    const report = await inspect(db, 'verification')
    const now = new Date()
    await db
        .update(catalogMigrationRuns)
        .set({
            verification: report,
            verifiedAt: now,
            updatedAt: now,
            ...(report.verified
                ? { status: 'complete' as const, stage: 'complete' as const, completedAt: now }
                : {
                      status: 'awaiting-verification' as const,
                      stage: 'verification' as const,
                      completedAt: null,
                  }),
        })
        .where(
            and(
                eq(catalogMigrationRuns.id, CATALOG_MIGRATION_ID),
                or(
                    eq(catalogMigrationRuns.status, 'awaiting-verification'),
                    eq(catalogMigrationRuns.status, 'complete'),
                ),
            ),
        )
    return report
}

/** Starts/resumes the journal only. The Queue owns execution. */
export const startCatalogV2Backfill = async (db: AppDatabase) => {
    const now = new Date()
    await db
        .insert(catalogMigrationRuns)
        .values({
            id: CATALOG_MIGRATION_ID,
            stage: 'publishers',
            status: 'running',
            startedAt: now,
            updatedAt: now,
        })
        .onConflictDoNothing()
    await db
        .update(catalogMigrationRuns)
        .set({ status: 'running', lastError: null, updatedAt: now })
        .where(
            and(
                eq(catalogMigrationRuns.id, CATALOG_MIGRATION_ID),
                eq(catalogMigrationRuns.status, 'failed'),
            ),
        )
    await db
        .update(catalogMigrationRuns)
        .set({
            status: 'running',
            stage: 'publishers',
            cursor: null,
            processed: 0,
            verification: null,
            verifiedAt: null,
            completedAt: null,
            updatedAt: now,
        })
        .where(
            and(
                eq(catalogMigrationRuns.id, CATALOG_MIGRATION_ID),
                eq(catalogMigrationRuns.status, 'awaiting-verification'),
            ),
        )
    return (await getCatalogMigrationRun(db))!
}

const publisherStatements = (db: AppDatabase, shop: typeof shops.$inferSelect) => {
    const publisherId = crypto.randomUUID()
    const sourceId = crypto.randomUUID()
    return {
        sourceId,
        statements: [
            db
                .insert(publishers)
                .values({ id: publisherId, createdAt: shop.createdAt, updatedAt: shop.updatedAt }),
            db.insert(publisherSources).values({
                id: sourceId,
                publisherId,
                createdAt: shop.createdAt,
                updatedAt: shop.updatedAt,
                providerKey: shop.platform,
                externalId: shop.id,
                canonicalUrl: legacyPublisherCanonicalUrl(shop.platform, shop.id),
                name: shop.name,
                image: shop.image,
                providerVerified: shop.verified,
            }),
        ] satisfies Statement[],
    }
}

const catalogStatements = async (
    db: AppDatabase,
    item: typeof items.$inferSelect,
    publisherSourceId: string | null,
) => {
    const [override] = await db
        .select()
        .from(itemCategoryOverrides)
        .where(
            and(
                eq(itemCategoryOverrides.itemId, item.id),
                eq(itemCategoryOverrides.platform, item.platform),
            ),
        )
        .limit(1)
    const migrated = migrateLegacyItemState(item, override?.category)
    const itemId = crypto.randomUUID()
    return [
        db.insert(catalogItems).values({
            id: itemId,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
            ...migrated.catalog,
        }),
        db.insert(itemSources).values({
            id: crypto.randomUUID(),
            itemId,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
            publisherSourceId,
            canonicalUrl: legacyItemCanonicalUrl(item.platform, item.id),
            primary: true,
            ...migrated.source,
        }),
    ] satisfies Statement[]
}

/** Retained Queue identities get a bounded mapping, never the legacy resolver. */
export const ensureLegacyCatalogSource = async (
    db: AppDatabase,
    providerKey: 'booth' | 'github',
    externalId: string,
) => {
    const find = async () =>
        (
            await db
                .select()
                .from(itemSources)
                .where(
                    and(
                        eq(itemSources.providerKey, providerKey),
                        eq(itemSources.externalId, externalId),
                    ),
                )
                .limit(1)
        )[0]
    const existing = await find()
    if (existing) return existing
    const [item] = await db
        .select()
        .from(items)
        .where(and(eq(items.id, externalId), eq(items.platform, providerKey)))
        .limit(1)
    if (!item) return null
    const statements: Statement[] = []
    let publisherSourceId: string | null = null
    if (item.shopId) {
        const [source] = await db
            .select()
            .from(publisherSources)
            .where(
                and(
                    eq(publisherSources.providerKey, providerKey),
                    eq(publisherSources.externalId, item.shopId),
                ),
            )
            .limit(1)
        publisherSourceId = source?.id ?? null
        if (!source) {
            const [shop] = await db
                .select()
                .from(shops)
                .where(and(eq(shops.id, item.shopId), eq(shops.platform, item.platform)))
                .limit(1)
            if (!shop) throw new Error(`Missing publisher for legacy item ${item.id}`)
            const pair = publisherStatements(db, shop)
            publisherSourceId = pair.sourceId
            statements.push(...pair.statements)
        }
    }
    statements.push(...(await catalogStatements(db, item, publisherSourceId)))
    try {
        await executeD1Batch(db, statements)
    } catch (error) {
        if (!(await find())) throw error
    }
    return (await find()) ?? null
}

const planChunk = async (db: AppDatabase, run: Run) => {
    const statements: Statement[] = []
    let ids: (string | number)[] = []
    if (run.stage === 'publishers') {
        const rows = await db
            .select()
            .from(shops)
            .where(run.cursor ? gt(shops.id, run.cursor) : undefined)
            .orderBy(shops.id)
            .limit(CATALOG_MIGRATION_CHUNK_SIZE)
        ids = rows.map((row) => row.id)
        for (const shop of rows) {
            const [source] = await db
                .select({ id: publisherSources.id })
                .from(publisherSources)
                .where(
                    and(
                        eq(publisherSources.providerKey, shop.platform),
                        eq(publisherSources.externalId, shop.id),
                    ),
                )
                .limit(1)
            if (!source) statements.push(...publisherStatements(db, shop).statements)
        }
    } else if (run.stage === 'catalog') {
        const rows = await db
            .select()
            .from(items)
            .where(run.cursor ? gt(items.id, run.cursor) : undefined)
            .orderBy(items.id)
            .limit(CATALOG_MIGRATION_CHUNK_SIZE)
        ids = rows.map((row) => row.id)
        for (const item of rows) {
            const [existing] = await db
                .select({ id: itemSources.id })
                .from(itemSources)
                .where(
                    and(
                        eq(itemSources.providerKey, item.platform),
                        eq(itemSources.externalId, item.id),
                    ),
                )
                .limit(1)
            if (existing) continue
            const [publisher] = item.shopId
                ? await db
                      .select({ id: publisherSources.id })
                      .from(publisherSources)
                      .where(
                          and(
                              eq(publisherSources.providerKey, item.platform),
                              eq(publisherSources.externalId, item.shopId),
                          ),
                      )
                      .limit(1)
                : []
            if (item.shopId && !publisher)
                throw new Error(`Missing publisher for legacy item ${item.id}`)
            statements.push(...(await catalogStatements(db, item, publisher?.id ?? null)))
        }
    } else if (run.stage === 'ownerships') {
        const rows = await db
            .select()
            .from(userShops)
            .where(run.cursor ? gt(userShops.id, Number(run.cursor)) : undefined)
            .orderBy(userShops.id)
            .limit(CATALOG_MIGRATION_CHUNK_SIZE)
        ids = rows.map((row) => row.id)
        for (const owner of rows) {
            const [source] = await db
                .select({ id: publisherSources.id, publisherId: publisherSources.publisherId })
                .from(shops)
                .innerJoin(
                    publisherSources,
                    and(
                        eq(publisherSources.externalId, shops.id),
                        eq(publisherSources.providerKey, shops.platform),
                    ),
                )
                .where(eq(shops.id, owner.shopId))
                .limit(1)
            if (!source) throw new Error(`Missing publisher for ownership ${owner.id}`)
            statements.push(
                db
                    .insert(userPublishers)
                    .values({
                        id: crypto.randomUUID(),
                        userId: owner.userId,
                        publisherId: source.publisherId,
                        createdAt: owner.createdAt,
                    })
                    .onConflictDoNothing(),
                db
                    .insert(publisherSourceOwnerships)
                    .values({
                        id: crypto.randomUUID(),
                        userId: owner.userId,
                        publisherSourceId: source.id,
                        method: 'legacy-shop-verification',
                        verifiedAt: owner.createdAt,
                    })
                    .onConflictDoNothing(),
            )
        }
        // Pending legacy challenges are intentionally not portable; users restart proof of control.
    } else if (run.stage === 'setup-entries') {
        const rows = await db
            .select()
            .from(setupItems)
            .where(run.cursor ? gt(setupItems.id, run.cursor) : undefined)
            .orderBy(setupItems.id)
            .limit(CATALOG_MIGRATION_CHUNK_SIZE)
        ids = rows.map((row) => row.id)
        for (const entry of rows) {
            const [source] = await db
                .select({ itemId: itemSources.itemId })
                .from(items)
                .innerJoin(
                    itemSources,
                    and(
                        eq(itemSources.externalId, items.id),
                        eq(itemSources.providerKey, items.platform),
                    ),
                )
                .where(eq(items.id, entry.itemId))
                .limit(1)
            if (!source) throw new Error(`Missing CatalogItem for SetupEntry ${entry.id}`)
            statements.push(
                db
                    .insert(setupEntries)
                    .values(migrateLegacySetupEntry(entry, source.itemId))
                    .onConflictDoNothing(),
            )
        }
    } else if (run.stage === 'shapekeys') {
        const rows = await db
            .select()
            .from(setupItemShapekeys)
            .where(run.cursor ? gt(setupItemShapekeys.id, Number(run.cursor)) : undefined)
            .orderBy(setupItemShapekeys.id)
            .limit(CATALOG_MIGRATION_CHUNK_SIZE)
        ids = rows.map((row) => row.id)
        statements.push(
            ...rows.map((row) =>
                db
                    .insert(setupEntryShapekeys)
                    .values(migrateLegacyShapekey(row))
                    .onConflictDoNothing(),
            ),
        )
    }
    const last = ids.at(-1)
    const stage =
        last === undefined
            ? (stages[stages.indexOf(run.stage as (typeof stages)[number]) + 1] ?? 'verification')
            : run.stage
    return {
        statements,
        cursor: last === undefined ? null : String(last),
        stage,
        processed: run.processed + ids.length,
    }
}

/** One leased, atomic chunk per delivery. Retry after an expired lease resumes its checkpoint. */
export const runCatalogMigrationChunk = async (db: AppDatabase, now = new Date()) => {
    const token = crypto.randomUUID()
    const [run] = await db
        .update(catalogMigrationRuns)
        .set({ leaseToken: token, leaseUntil: new Date(now.getTime() + 60_000), updatedAt: now })
        .where(
            and(
                eq(catalogMigrationRuns.id, CATALOG_MIGRATION_ID),
                eq(catalogMigrationRuns.status, 'running'),
                or(
                    isNull(catalogMigrationRuns.leaseUntil),
                    lte(catalogMigrationRuns.leaseUntil, now),
                ),
            ),
        )
        .returning()
    if (!run) {
        const current = await getCatalogMigrationRun(db)
        return { more: current?.status === 'running', run: current }
    }
    const ownsLease = and(
        eq(catalogMigrationRuns.id, run.id),
        eq(catalogMigrationRuns.leaseToken, token),
    )
    try {
        const chunk = await planChunk(db, run)
        const awaitingVerification = chunk.stage === 'verification'
        await executeD1Batch(db, [
            // D1 has no callback transactions. This NOT NULL assertion aborts the entire
            // batch if another worker reclaimed the lock while this chunk was reading.
            db
                .update(catalogMigrationRuns)
                .set({
                    stage: sql`CASE WHEN ${catalogMigrationRuns.leaseToken} = ${token} THEN ${catalogMigrationRuns.stage} ELSE NULL END`,
                })
                .where(eq(catalogMigrationRuns.id, run.id)),
            ...chunk.statements,
            db
                .update(catalogMigrationRuns)
                .set({
                    stage: chunk.stage,
                    cursor: chunk.cursor,
                    processed: chunk.processed,
                    status: awaitingVerification ? 'awaiting-verification' : 'running',
                    leaseToken: null,
                    leaseUntil: null,
                    lastError: null,
                    updatedAt: new Date(),
                })
                .where(ownsLease),
        ])
        return { more: !awaitingVerification, run: await getCatalogMigrationRun(db) }
    } catch (error) {
        await db
            .update(catalogMigrationRuns)
            .set({
                status: 'failed',
                leaseToken: null,
                leaseUntil: null,
                lastError: `Chunk failed at ${run.stage}/${run.cursor ?? 'start'}; inspect Worker logs.`,
                updatedAt: new Date(),
            })
            .where(ownsLease)
        throw error
    }
}
