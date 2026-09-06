import type {
    Publisher,
    PublisherChallengeDetails,
    PublisherOwnershipDetails,
    PublisherRepository,
    PublisherSource,
    PublisherSourceOwnership,
    PublisherSourceSnapshot,
    PublisherVerificationChallenge,
} from '@avatio/core/publishers'
import type { D1Database } from '@cloudflare/workers-types'
import { and, eq, notExists, or, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'

import {
    publishers,
    publisherSourceOwnerships,
    publisherSources,
    publisherVerificationChallenges,
    userBadges,
} from '../../../../database/schema'

type Database = ReturnType<typeof drizzle>

const mapPublisher = (row: typeof publishers.$inferSelect): Publisher => ({
    id: row.id,
    displayNameOverride: row.displayNameOverride,
    imageOverride: row.imageOverride,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
})

const mapSource = (row: typeof publisherSources.$inferSelect): PublisherSource => ({
    id: row.id,
    publisherId: row.publisherId,
    providerKey: row.providerKey,
    externalId: row.externalId,
    canonicalUrl: row.canonicalUrl,
    name: row.name,
    image: row.image,
    providerVerified: row.providerVerified,
    metadata: row.metadata ?? {},
})

const mapChallenge = (
    row: typeof publisherVerificationChallenges.$inferSelect,
): PublisherVerificationChallenge => ({
    id: row.id,
    userId: row.userId,
    publisherSourceId: row.publisherSourceId,
    method: row.method,
    code: row.code,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
})

const mapOwnership = (
    row: typeof publisherSourceOwnerships.$inferSelect,
): PublisherSourceOwnership => ({
    id: row.id,
    userId: row.userId,
    publisherSourceId: row.publisherSourceId,
    method: row.method,
    verifiedAt: row.verifiedAt,
})

export class D1PublisherRepository implements PublisherRepository {
    readonly #db: Database

    constructor(database: D1Database) {
        this.#db = drizzle(database)
    }

    async #findSource(providerKey: string, externalId: string) {
        const [source] = await this.#db
            .select()
            .from(publisherSources)
            .where(
                and(
                    eq(publisherSources.providerKey, providerKey),
                    eq(publisherSources.externalId, externalId),
                ),
            )
            .limit(1)
        return source ?? null
    }

    async upsertSource(snapshot: PublisherSourceSnapshot): Promise<PublisherSource> {
        const existing = await this.#findSource(snapshot.providerKey, snapshot.externalId)
        if (existing) {
            const [updated] = await this.#db
                .update(publisherSources)
                .set(snapshot)
                .where(eq(publisherSources.id, existing.id))
                .returning()
            return mapSource(updated ?? existing)
        }

        const publisherId = crypto.randomUUID()
        const sourceId = crypto.randomUUID()
        try {
            await this.#db.batch([
                this.#db.insert(publishers).values({ id: publisherId }),
                this.#db.insert(publisherSources).values({
                    id: sourceId,
                    publisherId,
                    ...snapshot,
                }),
            ])
            return { id: sourceId, publisherId, ...snapshot }
        } catch (error) {
            const raced = await this.#findSource(snapshot.providerKey, snapshot.externalId)
            if (!raced) throw error
            return mapSource(raced)
        }
    }

    async createChallenge(challenge: PublisherVerificationChallenge): Promise<void> {
        await this.#db.insert(publisherVerificationChallenges).values(challenge)
    }

    async findChallenge(id: string): Promise<PublisherChallengeDetails | null> {
        const [challenge] = await this.#db
            .select()
            .from(publisherVerificationChallenges)
            .where(eq(publisherVerificationChallenges.id, id))
            .limit(1)
        if (!challenge) return null

        const [source] = await this.#db
            .select()
            .from(publisherSources)
            .where(eq(publisherSources.id, challenge.publisherSourceId))
            .limit(1)
        return source ? { challenge: mapChallenge(challenge), source: mapSource(source) } : null
    }

    async deleteChallenge(id: string, userId: string): Promise<void> {
        await this.#db
            .delete(publisherVerificationChallenges)
            .where(
                and(
                    eq(publisherVerificationChallenges.id, id),
                    eq(publisherVerificationChallenges.userId, userId),
                ),
            )
    }

    async consumeChallengeAndCreateOwnership(
        challenge: PublisherVerificationChallenge,
        verifiedAt: Date,
    ): Promise<PublisherSourceOwnership | null> {
        const ownershipId = crypto.randomUUID()
        const insertOwnership = this.#db
            .insert(publisherSourceOwnerships)
            .select(
                this.#db
                    .select({
                        id: sql<string>`${ownershipId}`.as('id'),
                        userId: publisherVerificationChallenges.userId,
                        publisherSourceId: publisherVerificationChallenges.publisherSourceId,
                        method: publisherVerificationChallenges.method,
                        verifiedAt: sql`${verifiedAt.getTime()}`.as('verified_at'),
                    })
                    .from(publisherVerificationChallenges)
                    .where(
                        and(
                            eq(publisherVerificationChallenges.id, challenge.id),
                            eq(publisherVerificationChallenges.userId, challenge.userId),
                            eq(
                                publisherVerificationChallenges.publisherSourceId,
                                challenge.publisherSourceId,
                            ),
                        ),
                    ),
            )
            .onConflictDoNothing()
            .returning()
        const deleteChallenge = this.#db
            .delete(publisherVerificationChallenges)
            .where(
                and(
                    eq(publisherVerificationChallenges.id, challenge.id),
                    eq(publisherVerificationChallenges.userId, challenge.userId),
                ),
            )
            .returning({ id: publisherVerificationChallenges.id })

        const [, deleted] = await this.#db.batch([insertOwnership, deleteChallenge])
        if (!(deleted as { id: string }[])[0]) return null

        await this.#db
            .insert(userBadges)
            .values({ userId: challenge.userId, badge: 'publisher_owner' })
            .onConflictDoNothing({ target: [userBadges.userId, userBadges.badge] })

        const [ownership] = await this.#db
            .select()
            .from(publisherSourceOwnerships)
            .where(
                and(
                    eq(publisherSourceOwnerships.userId, challenge.userId),
                    eq(publisherSourceOwnerships.publisherSourceId, challenge.publisherSourceId),
                ),
            )
            .limit(1)
        return ownership ? mapOwnership(ownership) : null
    }

    async listOwnerships(userId: string): Promise<PublisherOwnershipDetails[]> {
        const rows = await this.#db
            .select({
                ownership: publisherSourceOwnerships,
                source: publisherSources,
                publisher: publishers,
            })
            .from(publisherSourceOwnerships)
            .innerJoin(
                publisherSources,
                eq(publisherSources.id, publisherSourceOwnerships.publisherSourceId),
            )
            .innerJoin(publishers, eq(publishers.id, publisherSources.publisherId))
            .where(eq(publisherSourceOwnerships.userId, userId))

        return rows.map((row) => ({
            ...mapOwnership(row.ownership),
            source: mapSource(row.source),
            publisher: mapPublisher(row.publisher),
        }))
    }

    async deleteOwnership(id: string, userId: string): Promise<boolean> {
        const [deleted] = await this.#db.batch([
            this.#db
                .delete(publisherSourceOwnerships)
                .where(
                    and(
                        eq(publisherSourceOwnerships.id, id),
                        eq(publisherSourceOwnerships.userId, userId),
                    ),
                )
                .returning({ id: publisherSourceOwnerships.id }),
            this.#db
                .delete(userBadges)
                .where(
                    and(
                        eq(userBadges.userId, userId),
                        or(
                            eq(userBadges.badge, 'publisher_owner'),
                            eq(userBadges.badge, 'shop_owner'),
                        ),
                        notExists(
                            this.#db
                                .select({ id: publisherSourceOwnerships.id })
                                .from(publisherSourceOwnerships)
                                .where(eq(publisherSourceOwnerships.userId, userId)),
                        ),
                    ),
                ),
        ])
        return Boolean((deleted as { id: string }[])[0])
    }
}
