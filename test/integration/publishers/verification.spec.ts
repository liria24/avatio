import { SQLitePublisherRepository } from '@avatio/cloudflare'
import {
    createPublisherVerificationChallenge,
    PublisherVerificationError,
    PublisherVerificationProviderRegistry,
    verifyPublisherVerificationChallenge,
    type PublisherVerificationProvider,
} from '@avatio/core/publishers'
import type { ProviderHttpClient } from '@avatio/nuxt/runtime/server/catalog/providers'
import { BoothPublisherVerificationProvider } from '@avatio/nuxt/runtime/server/publishers/providers'
import { drizzle } from 'drizzle-orm/d1'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { relations } from '../../../database/relations'
import { executeAppBatch } from '../../../server/utils/executeAppBatch'
import { createTestD1 } from '../../helpers/d1'

let database: ReturnType<typeof createTestD1>
let repository: SQLitePublisherRepository
beforeEach(() => {
    database = createTestD1()
    const db = drizzle(database.binding, { relations })
    repository = new SQLitePublisherRepository(db, (queries) => executeAppBatch(db, queries))
    for (const id of ['user', 'owner', 'other'])
        database.sqlite
            .prepare(
                'INSERT INTO users (id, name, username, display_username, email) VALUES (?, ?, ?, ?, ?)',
            )
            .run(id, id, id, id, id + '@example.com')
})
afterEach(() => database.sqlite.close())

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
        expect(ownership.publisherSourceId).toBe(challenge.source.id)
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

        const badges = () =>
            database.sqlite
                .prepare('SELECT badge FROM user_badges WHERE user_id = ? ORDER BY badge')
                .all('owner')
                .map((row) => row.badge)
        database.sqlite.exec(
            "INSERT INTO user_badges (user_id, badge) VALUES ('owner', 'shop_owner'), ('owner', 'contributor'), ('other', 'publisher_owner')",
        )
        database.sqlite
            .prepare(
                "INSERT INTO publisher_source_ownerships (id, user_id, publisher_source_id, method, verified_at) VALUES ('other-ownership', 'other', ?, 'description', 1)",
            )
            .run(owned[0]!.publisherSourceId)
        expect(await repository.deleteOwnership(owned[0]!.id, 'other')).toBe(false)
        expect(await repository.listOwnerships('owner')).toHaveLength(2)
        expect(await repository.deleteOwnership(owned[0]!.id, 'owner')).toBe(true)
        expect((await repository.listOwnerships('owner')).map((row) => row.id)).toEqual([
            owned[1]!.id,
        ])
        expect(badges()).toEqual(['contributor', 'publisher_owner', 'shop_owner'])
        expect(await repository.deleteOwnership(owned[1]!.id, 'owner')).toBe(true)
        expect(await repository.listOwnerships('owner')).toEqual([])
        expect(badges()).toEqual(['contributor'])
        expect(
            database.sqlite.prepare('SELECT badge FROM user_badges WHERE user_id = ?').all('other'),
        ).toEqual([{ badge: 'publisher_owner' }])
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
