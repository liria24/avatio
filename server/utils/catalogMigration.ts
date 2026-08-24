import {
    catalogItems,
    itemCategoryOverrides,
    items,
    itemSources,
    publisherSources,
    publisherVerificationChallenges,
    publishers,
    setupEntries,
    setupEntryShapekeys,
    setupItems,
    setupItemShapekeys,
    setups,
    shops,
    userPublishers,
    userShopVerifications,
    userShops,
} from '@@/database/schema'
import type { BatchItem } from 'drizzle-orm/batch'

import {
    legacyItemCanonicalUrl,
    legacyPublisherCanonicalUrl,
    migrateLegacyItemState,
    migrateLegacySetupEntry,
    migrateLegacyShapekey,
} from './catalogLegacyMigration'
import type { AppDatabase } from './database'
import { executeD1Batch } from './executeD1Batch'

const MAX_D1_BATCH_STATEMENTS = 90

type Statement = BatchItem<'sqlite'>

interface BackfillIssue {
    severity: 'error' | 'warning'
    kind: string
    legacyId: string
    reason: string
}

interface BackfillPlan {
    publisherPairs: Statement[][]
    catalogPairs: Statement[][]
    userPublisherStatements: Statement[]
    challengeStatements: Statement[]
    setupEntryStatements: Statement[]
    shapekeyStatements: Statement[]
    issues: BackfillIssue[]
    expected: {
        publishers: number
        catalogItems: number
        userPublishers: number
        challenges: number
        setupEntries: number
        shapekeys: number
    }
}

export interface CatalogBackfillReport {
    mode: 'dry-run' | 'applied' | 'verification'
    pending: {
        publishers: number
        catalogItems: number
        userPublishers: number
        challenges: number
        setupEntries: number
        shapekeys: number
    }
    expected: BackfillPlan['expected']
    issues: BackfillIssue[]
    verified: boolean
}

const externalKey = (providerKey: string, externalId: string) => `${providerKey}\u0000${externalId}`

const pairKey = (left: string, right: string) => `${left}\u0000${right}`

const runStatementGroups = async (db: AppDatabase, groups: Statement[][]) => {
    let batch: Statement[] = []
    for (const group of groups) {
        if (batch.length && batch.length + group.length > MAX_D1_BATCH_STATEMENTS) {
            await executeD1Batch(db, batch)
            batch = []
        }
        batch.push(...group)
    }
    if (batch.length) await executeD1Batch(db, batch)
}

const runStatements = async (db: AppDatabase, statements: Statement[]) => {
    for (let offset = 0; offset < statements.length; offset += MAX_D1_BATCH_STATEMENTS) {
        await executeD1Batch(db, statements.slice(offset, offset + MAX_D1_BATCH_STATEMENTS))
    }
}

const createBackfillPlan = async (db: AppDatabase): Promise<BackfillPlan> => {
    const [
        legacyShops,
        legacyItems,
        legacyOverrides,
        legacyUserShops,
        legacyChallenges,
        legacySetupItems,
        legacyShapekeys,
        existingPublisherSources,
        existingItemSources,
        existingUserPublishers,
        existingChallenges,
        existingSetupEntries,
        existingShapekeys,
        existingSetups,
    ] = await Promise.all([
        db.select().from(shops),
        db.select().from(items),
        db.select().from(itemCategoryOverrides),
        db.select().from(userShops),
        db.select().from(userShopVerifications),
        db.select().from(setupItems),
        db.select().from(setupItemShapekeys),
        db.select().from(publisherSources),
        db.select().from(itemSources),
        db.select().from(userPublishers),
        db.select().from(publisherVerificationChallenges),
        db.select().from(setupEntries),
        db.select().from(setupEntryShapekeys),
        db.select({ id: setups.id }).from(setups),
    ])

    const issues: BackfillIssue[] = []
    const publisherPairs: Statement[][] = []
    const catalogPairs: Statement[][] = []
    const userPublisherStatements: Statement[] = []
    const challengeStatements: Statement[] = []
    const setupEntryStatements: Statement[] = []
    const shapekeyStatements: Statement[] = []

    const publisherSourceByExternal = new Map(
        existingPublisherSources.map((source) => [
            externalKey(source.providerKey, source.externalId),
            { id: source.id, publisherId: source.publisherId },
        ]),
    )
    const legacyShopById = new Map(legacyShops.map((shop) => [shop.id, shop]))

    for (const shop of legacyShops) {
        const key = externalKey(shop.platform, shop.id)
        if (publisherSourceByExternal.has(key)) continue

        const publisherId = crypto.randomUUID()
        const sourceId = crypto.randomUUID()
        publisherSourceByExternal.set(key, { id: sourceId, publisherId })
        publisherPairs.push([
            db.insert(publishers).values({
                id: publisherId,
                createdAt: shop.createdAt,
                updatedAt: shop.updatedAt,
                displayNameOverride: null,
                imageOverride: null,
            }),
            db.insert(publisherSources).values({
                id: sourceId,
                createdAt: shop.createdAt,
                updatedAt: shop.updatedAt,
                publisherId,
                providerKey: shop.platform,
                externalId: shop.id,
                canonicalUrl: legacyPublisherCanonicalUrl(shop.platform, shop.id),
                name: shop.name,
                image: shop.image,
                providerVerified: shop.verified,
            }),
        ])
    }

    const overrideByItem = new Map(
        legacyOverrides.map((override) => [
            externalKey(override.platform, override.itemId),
            override.category,
        ]),
    )
    const itemSourceByExternal = new Map(
        existingItemSources.map((source) => [
            externalKey(source.providerKey, source.externalId),
            {
                id: source.id,
                itemId: source.itemId,
                availability: source.availability,
                lastErrorKind: source.lastErrorKind,
            },
        ]),
    )
    const legacyItemById = new Map(legacyItems.map((item) => [item.id, item]))

    for (const item of legacyItems) {
        const key = externalKey(item.platform, item.id)
        const existing = itemSourceByExternal.get(key)
        if (existing) {
            if (existing.itemId === item.id) {
                issues.push({
                    severity: 'error',
                    kind: 'catalog-identity',
                    legacyId: item.id,
                    reason: 'CatalogItem ID must be independent from the provider external ID.',
                })
            }
            if (
                item.outdated &&
                existing.availability === 'withdrawn' &&
                existing.lastErrorKind === 'legacy-unconfirmed-outdated'
            ) {
                issues.push({
                    severity: 'error',
                    kind: 'availability',
                    legacyId: item.id,
                    reason: 'Legacy outdated=true was mapped to withdrawn.',
                })
            }
            continue
        }

        const catalogItemId = crypto.randomUUID()
        const sourceId = crypto.randomUUID()
        const publisherSource = item.shopId
            ? publisherSourceByExternal.get(externalKey(item.platform, item.shopId))
            : undefined
        if (item.shopId && !publisherSource) {
            issues.push({
                severity: 'error',
                kind: 'publisher-reference',
                legacyId: item.id,
                reason: `Legacy shop ${item.shopId} does not exist for provider ${item.platform}.`,
            })
        }

        const explicitOverride = overrideByItem.get(key)
        const migrated = migrateLegacyItemState(item, explicitOverride)
        itemSourceByExternal.set(key, {
            id: sourceId,
            itemId: catalogItemId,
            availability: item.outdated ? 'unknown' : 'available',
            lastErrorKind: item.outdated ? 'legacy-unconfirmed-outdated' : null,
        })
        catalogPairs.push([
            db.insert(catalogItems).values({
                id: catalogItemId,
                createdAt: item.createdAt,
                updatedAt: item.updatedAt,
                ...migrated.catalog,
            }),
            db.insert(itemSources).values({
                id: sourceId,
                createdAt: item.createdAt,
                updatedAt: item.updatedAt,
                itemId: catalogItemId,
                publisherSourceId: publisherSource?.id ?? null,
                providerKey: item.platform,
                externalId: item.id,
                canonicalUrl: legacyItemCanonicalUrl(item.platform, item.id),
                primary: true,
                availability: migrated.source.availability,
                syncState: migrated.source.syncState,
                providerCategoryKey: null,
                providerCategoryLabel: null,
                mappedCategory: null,
                displayName: migrated.source.displayName,
                image: migrated.source.image,
                price: migrated.source.price,
                popularityCount: migrated.source.popularityCount,
                nsfw: migrated.source.nsfw,
                lastCheckedAt: migrated.source.lastCheckedAt,
                lastSuccessfulSyncAt: migrated.source.lastSuccessfulSyncAt,
                nextCheckAt: migrated.source.nextCheckAt,
                syncLeaseUntil: null,
                lastErrorKind: migrated.source.lastErrorKind,
                lastErrorAt: migrated.source.lastErrorAt,
            }),
        ])
    }

    const existingUserPublisherKeys = new Set(
        existingUserPublishers.map((owner) => pairKey(owner.userId, owner.publisherId)),
    )
    for (const owner of legacyUserShops) {
        const shop = legacyShopById.get(owner.shopId)
        if (!shop) {
            issues.push({
                severity: 'error',
                kind: 'publisher-owner',
                legacyId: owner.id.toString(),
                reason: `Legacy shop ${owner.shopId} does not exist.`,
            })
            continue
        }
        const publisherSource = publisherSourceByExternal.get(externalKey(shop.platform, shop.id))
        if (!publisherSource) continue
        const key = pairKey(owner.userId, publisherSource.publisherId)
        if (existingUserPublisherKeys.has(key)) continue
        existingUserPublisherKeys.add(key)
        userPublisherStatements.push(
            db.insert(userPublishers).values({
                id: crypto.randomUUID(),
                createdAt: owner.createdAt,
                userId: owner.userId,
                publisherId: publisherSource.publisherId,
            }),
        )
    }

    const existingChallengeUsers = new Set(existingChallenges.map((challenge) => challenge.userId))
    for (const challenge of legacyChallenges) {
        if (existingChallengeUsers.has(challenge.userId)) continue
        existingChallengeUsers.add(challenge.userId)
        challengeStatements.push(
            db.insert(publisherVerificationChallenges).values({
                id: challenge.id,
                code: challenge.code,
                createdAt: challenge.createdAt,
                userId: challenge.userId,
            }),
        )
    }

    const existingEntryIds = new Set(existingSetupEntries.map((entry) => entry.id))
    const mappedEntryIds = new Set(existingEntryIds)
    for (const entry of legacySetupItems) {
        if (existingEntryIds.has(entry.id)) continue
        const legacyItem = legacyItemById.get(entry.itemId)
        const source = legacyItem
            ? itemSourceByExternal.get(externalKey(legacyItem.platform, legacyItem.id))
            : undefined
        if (!legacyItem || !source) {
            issues.push({
                severity: 'error',
                kind: 'setup-entry',
                legacyId: entry.id,
                reason: `Legacy item ${entry.itemId} cannot be mapped to a CatalogItem.`,
            })
            continue
        }
        mappedEntryIds.add(entry.id)
        setupEntryStatements.push(
            db.insert(setupEntries).values(migrateLegacySetupEntry(entry, source.itemId)),
        )
    }

    const existingShapekeyIds = new Set(existingShapekeys.map((shapekey) => shapekey.id))
    for (const shapekey of legacyShapekeys) {
        if (existingShapekeyIds.has(shapekey.id)) continue
        if (!mappedEntryIds.has(shapekey.setupItemId)) {
            issues.push({
                severity: 'error',
                kind: 'setup-entry-shapekey',
                legacyId: shapekey.id.toString(),
                reason: `SetupEntry ${shapekey.setupItemId} is unavailable.`,
            })
            continue
        }
        shapekeyStatements.push(
            db.insert(setupEntryShapekeys).values(migrateLegacyShapekey(shapekey)),
        )
    }

    for (const setup of existingSetups) {
        if (!/^[A-Za-z0-9_-]{8}$/.test(setup.id)) {
            issues.push({
                severity: 'warning',
                kind: 'setup-id-shape',
                legacyId: setup.id,
                reason: 'Existing Setup ID is not the expected opaque 8-character format.',
            })
        }
    }

    return {
        publisherPairs,
        catalogPairs,
        userPublisherStatements,
        challengeStatements,
        setupEntryStatements,
        shapekeyStatements,
        issues,
        expected: {
            publishers: legacyShops.length,
            catalogItems: legacyItems.length,
            userPublishers: legacyUserShops.length,
            challenges: legacyChallenges.length,
            setupEntries: legacySetupItems.length,
            shapekeys: legacyShapekeys.length,
        },
    }
}

const reportFromPlan = (
    plan: BackfillPlan,
    mode: CatalogBackfillReport['mode'],
): CatalogBackfillReport => {
    const pending = {
        publishers: plan.publisherPairs.length,
        catalogItems: plan.catalogPairs.length,
        userPublishers: plan.userPublisherStatements.length,
        challenges: plan.challengeStatements.length,
        setupEntries: plan.setupEntryStatements.length,
        shapekeys: plan.shapekeyStatements.length,
    }
    return {
        mode,
        pending,
        expected: plan.expected,
        issues: plan.issues.slice(0, 100),
        verified:
            Object.values(pending).every((value) => value === 0) &&
            plan.issues.every((issue) => issue.severity === 'warning'),
    }
}

export const inspectCatalogV2Backfill = async (db: AppDatabase) =>
    reportFromPlan(await createBackfillPlan(db), 'dry-run')

export const verifyCatalogV2Backfill = async (db: AppDatabase) =>
    reportFromPlan(await createBackfillPlan(db), 'verification')

export const applyCatalogV2Backfill = async (db: AppDatabase) => {
    const plan = await createBackfillPlan(db)
    if (plan.issues.some((issue) => issue.severity === 'error'))
        return reportFromPlan(plan, 'dry-run')

    await runStatementGroups(db, plan.publisherPairs)
    await runStatementGroups(db, plan.catalogPairs)
    await runStatements(db, plan.userPublisherStatements)
    await runStatements(db, plan.challengeStatements)
    await runStatements(db, plan.setupEntryStatements)
    await runStatements(db, plan.shapekeyStatements)

    return reportFromPlan(await createBackfillPlan(db), 'applied')
}
