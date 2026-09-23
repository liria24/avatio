import {
    createPublisherVerificationChallenge,
    PublisherVerificationError,
    PublisherVerificationProviderRegistry,
    verifyPublisherVerificationChallenge,
    type PublisherRepository,
    type PublisherSource,
    type PublisherSourceOwnership,
    type PublisherVerificationChallenge,
    type PublisherVerificationProvider,
} from '@avatio/core/publishers'
import type { ProviderHttpClient } from '@avatio/nuxt/runtime/server/catalog/providers'
import { BoothPublisherVerificationProvider } from '@avatio/nuxt/runtime/server/publishers/providers'
import { describe, expect, it } from 'vitest'

const createMemoryRepository = () => {
    const sources = new Map<string, PublisherSource>()
    const challenges = new Map<string, PublisherVerificationChallenge>()
    const ownerships = new Map<string, PublisherSourceOwnership>()
    const repository = {
        async upsertSource(snapshot) {
            const key = `${snapshot.providerKey}\0${snapshot.externalId}`
            const source =
                sources.get(key) ??
                ({
                    id: `source:${key}`,
                    publisherId: `publisher:${key}`,
                    ...snapshot,
                } satisfies PublisherSource)
            sources.set(key, source)
            return source
        },
        async createChallenge(challenge) {
            challenges.set(challenge.id, challenge)
        },
        async findChallenge(id) {
            const challenge = challenges.get(id)
            if (!challenge) return null
            const source = [...sources.values()].find(
                ({ id: sourceId }) => sourceId === challenge.publisherSourceId,
            )
            return source ? { challenge, source } : null
        },
        async deleteChallenge(id, userId) {
            if (challenges.get(id)?.userId === userId) challenges.delete(id)
        },
        async consumeChallengeAndCreateOwnership(challenge, verifiedAt) {
            if (!challenges.delete(challenge.id)) return null
            const ownership = {
                id: `ownership:${challenge.id}`,
                userId: challenge.userId,
                publisherSourceId: challenge.publisherSourceId,
                method: challenge.method,
                verifiedAt,
            }
            ownerships.set(ownership.id, ownership)
            return ownership
        },
        async listOwnerships() {
            return []
        },
        async deleteOwnership(id, userId) {
            if (ownerships.get(id)?.userId !== userId) return false
            return ownerships.delete(id)
        },
    } satisfies PublisherRepository
    return { repository, challenges, ownerships }
}

const provider = (key: string): PublisherVerificationProvider => ({
    key,
    async resolveTarget(url) {
        if (url.hostname !== `${key}.example`) return null
        return {
            source: {
                providerKey: key,
                externalId: 'same-id',
                canonicalUrl: url.href,
                name: key,
                image: null,
                providerVerified: false,
                metadata: {},
            },
            method: 'description',
            instruction: { type: 'description', url: url.href },
            proof: url.searchParams.get('proof'),
        }
    },
    async verify({ target, code }) {
        return target.proof === code
    },
})

describe('publisher verification', () => {
    it('isolates challenges and ownership by provider and source', async () => {
        const { repository } = createMemoryRepository()
        const providers = new PublisherVerificationProviderRegistry([
            provider('first'),
            provider('second'),
        ])
        const now = new Date('2026-08-30T00:00:00Z')
        const challenge = await createPublisherVerificationChallenge({
            userId: 'user',
            url: new URL('https://first.example/item'),
            repository,
            providers,
            now,
            generateId: () => 'challenge',
            generateCode: () => 'secret',
        })

        await expect(
            verifyPublisherVerificationChallenge({
                id: challenge.id,
                userId: 'user',
                url: new URL('https://second.example/item?proof=secret'),
                repository,
                providers,
                now,
            }),
        ).rejects.toMatchObject({ code: 'target-mismatch' })

        const ownership = await verifyPublisherVerificationChallenge({
            id: challenge.id,
            userId: 'user',
            url: new URL('https://first.example/item?proof=secret'),
            repository,
            providers,
            now,
        })
        expect(ownership.publisherSourceId).toBe('source:first\0same-id')
        await expect(
            verifyPublisherVerificationChallenge({
                id: challenge.id,
                userId: 'user',
                url: new URL('https://first.example/item?proof=secret'),
                repository,
                providers,
                now,
            }),
        ).rejects.toMatchObject({ code: 'challenge-not-found' })
    })

    it('expires and isolates challenges by user', async () => {
        const { repository } = createMemoryRepository()
        const providers = new PublisherVerificationProviderRegistry([provider('first')])
        const challenge = await createPublisherVerificationChallenge({
            userId: 'owner',
            url: new URL('https://first.example/item'),
            repository,
            providers,
            now: new Date(0),
            generateId: () => 'challenge',
            generateCode: () => 'secret',
        })

        await expect(
            verifyPublisherVerificationChallenge({
                id: challenge.id,
                userId: 'other',
                url: new URL('https://first.example/item?proof=secret'),
                repository,
                providers,
                now: new Date(1),
            }),
        ).rejects.toBeInstanceOf(PublisherVerificationError)
        await expect(
            verifyPublisherVerificationChallenge({
                id: challenge.id,
                userId: 'owner',
                url: new URL('https://first.example/item?proof=secret'),
                repository,
                providers,
                now: new Date(16 * 60 * 1000),
            }),
        ).rejects.toMatchObject({ code: 'challenge-expired' })
    })

    it('removes one source ownership without affecting another source', async () => {
        const { repository, ownerships } = createMemoryRepository()
        const providers = new PublisherVerificationProviderRegistry([
            provider('first'),
            provider('second'),
        ])
        const owned = []
        for (const key of ['first', 'second']) {
            const challenge = await createPublisherVerificationChallenge({
                userId: 'owner',
                url: new URL(`https://${key}.example/item`),
                repository,
                providers,
                generateCode: () => 'secret',
            })
            owned.push(
                await verifyPublisherVerificationChallenge({
                    id: challenge.id,
                    userId: 'owner',
                    url: new URL(`https://${key}.example/item?proof=secret`),
                    repository,
                    providers,
                }),
            )
        }

        expect(await repository.deleteOwnership(owned[0]!.id, 'owner')).toBe(true)
        expect(ownerships.has(owned[0]!.id)).toBe(false)
        expect(ownerships.has(owned[1]!.id)).toBe(true)
    })

    it('checks BOOTH descriptions without applying catalog admission', async () => {
        const adapter = new BoothPublisherVerificationProvider({
            http: {
                get: (async (url: string) => {
                    expect(url).toBe('https://booth.pm/ja/items/123.json')
                    return {
                        status: 200,
                        ok: true,
                        data: {
                            id: '123',
                            url: 'https://booth.pm/items/123',
                            name: 'Item',
                            description: 'challenge-code',
                            price: '100',
                            wish_lists_count: 0,
                            is_adult: false,
                            category: { id: 999999, name: 'Not admitted' },
                            images: [],
                            shop: {
                                subdomain: 'publisher',
                                name: 'Publisher',
                                thumbnail_url: '',
                                url: 'https://publisher.booth.pm/',
                                verified: false,
                            },
                            tags: [],
                            variations: [],
                        },
                    }
                }) as ProviderHttpClient['get'],
            },
        })
        const target = await adapter.resolveTarget(new URL('https://booth.pm/items/123'))
        expect(target?.source.externalId).toBe('publisher')
        await expect(adapter.verify({ target: target!, code: 'challenge-code' })).resolves.toBe(
            true,
        )
        await expect(adapter.verify({ target: target!, code: 'wrong' })).resolves.toBe(false)
    })
})
