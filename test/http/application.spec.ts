import { randomUUID } from 'node:crypto'
import { glob, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { eq } from 'drizzle-orm'

import { sessions, users } from '../../database/schema'
import { startTestRuntime, type FixtureUser, type TestRuntime } from '../helpers/runtime'
import { draftContent, fixturePng, seedCatalogItem, seedSetup } from '../helpers/seeds'

let runtime: TestRuntime
let bannedAdmin: FixtureUser
beforeAll(async () => {
    runtime = await startTestRuntime()
    bannedAdmin = await runtime.createUser({ role: 'admin' })
    await runtime.db.update(users).set({ banned: true }).where(eq(users.id, bannedAdmin.id))
})
afterAll(async () => {
    await runtime?.clean()
})
const request = (path: string, user?: FixtureUser, init: RequestInit = {}) => {
    const headers = new Headers(user?.headers)
    headers.set('origin', 'http://localhost:3000')
    if (typeof init.body === 'string') headers.set('content-type', 'application/json')
    for (const [key, value] of new Headers(init.headers)) headers.set(key, value)
    return fetch(`http://localhost:3000${path}`, { ...init, headers })
}
const endpoints = await Array.fromAsync(glob('server/api/admin/**/*.ts'), (file) => {
    const match = file
        .replaceAll('\\', '/')
        .match(/server\/api\/(.+?)(?:\.(get|post|put|patch|delete))?\.ts$/)
    if (!match?.[1]) throw new Error(`Unsupported API route: ${file}`)
    return {
        path: `/api/${match[1].replace(/\/index$/, '').replace(/\[\.\.\.[^\]]+\]|\[[^\]]+\]/g, 'test')}`,
        method: (match[2] ?? 'get').toUpperCase(),
    }
})

describe('real HTTP authorization and ownership', () => {
    it.each(endpoints)('$method $path rejects anonymous requests', async ({ path, method }) => {
        expect((await request(path, undefined, { method })).status).toBe(401)
    })

    it.each(endpoints)(
        '$method $path rejects a banned admin with a retained session',
        async ({ path, method }) => {
            expect((await request(path, bannedAdmin, { method })).status).toBe(403)
        },
    )

    it('distinguishes ordinary users, admins and banned admins', async () => {
        const user = await runtime.createUser()
        expect((await request('/api/admin/config', user)).status).toBe(403)
        expect((await request('/api/admin/config', runtime.admin)).status).toBe(200)
        const banned = await runtime.createUser({ role: 'admin' })
        await runtime.db.update(users).set({ banned: true }).where(eq(users.id, banned.id))
        expect([401, 403]).toContain((await request('/api/admin/config', banned)).status)
    })

    it('rejects forged, expired and revoked sessions', async () => {
        const user = await runtime.createUser()
        const cookie = user.cookies[0]!
        expect(
            (
                await request('/api/setup-drafts', undefined, {
                    headers: { cookie: `${cookie.name}=forged` },
                })
            ).status,
        ).toBe(401)
        await runtime.db
            .update(sessions)
            .set({ expiresAt: new Date(0) })
            .where(eq(sessions.id, user.session.id))
        expect((await request('/api/setup-drafts', user)).status).toBe(401)
        const revoked = await runtime.createUser()
        await runtime.db.delete(sessions).where(eq(sessions.id, revoked.session.id))
        expect((await request('/api/setup-drafts', revoked)).status).toBe(401)
    })

    it.each([{ public: false }, { hidden: true }])(
        'keeps restricted Setup reads cookie-independent: %j',
        async (options) => {
            const owner = await runtime.createUser()
            const other = await runtime.createUser()
            const setup = await seedSetup(runtime, owner, options)
            for (const viewer of [undefined, owner, other, runtime.admin])
                expect((await request(`/api/setups/${setup.id}`, viewer)).status).toBe(404)
            for (const viewer of [owner, runtime.admin]) {
                const response = await request(`/api/me/setups/${setup.id}`, viewer)
                expect(response.status).toBe(200)
                expect(response.headers.get('cache-control')).toContain('no-store')
            }
            expect((await request(`/api/me/setups/${setup.id}`, other)).status).toBe(404)
            const body = JSON.stringify({
                name: 'Forbidden edit',
                items: [{ itemId: setup.item.id }],
            })
            for (const viewer of [other, runtime.admin])
                expect(
                    (await request(`/api/setups/${setup.id}`, viewer, { method: 'PUT', body }))
                        .status,
                ).toBe(403)
            expect(
                (await request(`/api/setups/${setup.id}`, owner, { method: 'PUT', body })).status,
            ).toBe(200)
        },
    )

    it('tags public reads and redirects legacy URLs with locale/query preserved', async () => {
        const owner = await runtime.createUser()
        const setup = await seedSetup(runtime, owner)
        const response = await request(`/api/setups/${setup.id}`)
        expect(response.status).toBe(200)
        expect(response.headers.get('cache-control')).not.toContain('no-store')
        expect(response.headers.get('cache-tag')).toContain(setup.id)
        for (const prefix of ['', '/en']) {
            const legacy = await request(`${prefix}/setup/${setup.id}?fixture=1`, undefined, {
                redirect: 'manual',
            })
            expect(legacy.status).toBe(308)
            expect(new URL(legacy.headers.get('location')!, runtime.origin).pathname).toBe(
                `${prefix}/${setup.id}`,
            )
            expect(new URL(legacy.headers.get('location')!, runtime.origin).search).toBe(
                '?fixture=1',
            )
        }
    })

    it('uses real database predicates for draft ownership and compare-and-swap', async () => {
        const owner = await runtime.createUser(),
            other = await runtime.createUser()
        const id = randomUUID()
        const save = (user: FixtureUser, expectedRevision: number, name: string) =>
            request(`/api/setup-drafts/${id}`, user, {
                method: 'PUT',
                body: JSON.stringify({
                    expectedRevision,
                    setupId: null,
                    content: draftContent(name),
                }),
            })
        expect((await save(owner, 0, 'Original')).status).toBe(200)
        expect((await request(`/api/setup-drafts/${id}`, other)).status).toBe(404)
        expect((await request(`/api/setup-drafts/${id}`, other, { method: 'DELETE' })).status).toBe(
            404,
        )
        expect((await save(owner, 1, 'Committed')).status).toBe(200)
        expect((await save(owner, 1, 'Stale overwrite')).status).toBe(409)
        expect(await (await request(`/api/setup-drafts/${id}`, owner)).json()).toMatchObject({
            revision: 2,
            content: { name: 'Committed' },
        })
    })

    it('checks multipart image bytes and owner keys through HTTP', async () => {
        const owner = await runtime.createUser(),
            other = await runtime.createUser()
        const form = new FormData()
        form.set('path', 'setup')
        form.set(
            'blob',
            new Blob([new Uint8Array(fixturePng())], { type: 'image/png' }),
            'fixture.png',
        )
        const uploaded = await request('/api/images', owner, { method: 'POST', body: form })
        expect(uploaded.status).toBe(200)
        const image = (await uploaded.json()) as {
            url: string
            objectKey: string
            width: number
            height: number
        }
        expect(image.objectKey.startsWith(`setup/${owner.id}/`)).toBe(true)
        expect((await fetch(image.url)).status).toBe(200)
        const setup = await seedSetup(runtime, other)
        const response = await request(`/api/setups/${setup.id}`, other, {
            method: 'PUT',
            body: JSON.stringify({
                items: [{ itemId: setup.item.id }],
                images: [image.url],
                imageMetadata: { [image.url]: image },
            }),
        })
        expect(response.status).toBe(400)
        const invalid = new FormData()
        invalid.set('path', 'setup')
        invalid.set('blob', new Blob(['invalid'], { type: 'image/png' }), 'bad.png')
        expect(
            (await request('/api/images', owner, { method: 'POST', body: invalid })).status,
        ).toBe(400)
        expect((await request('/api/_local/files/..%2f..%2fpackage.json')).status).toBe(400)
    })

    it('preserves stable image IDs and points when images are reordered or removed', async () => {
        const owner = await runtime.createUser()
        const item = await seedCatalogItem(runtime)
        const entryId = randomUUID()
        const images: (Record<string, unknown> & { id: string; url: string })[] = []
        for (let i = 0; i < 2; i += 1) {
            const form = new FormData()
            form.set('path', 'setup')
            form.set(
                'blob',
                new Blob([new Uint8Array(fixturePng())], { type: 'image/png' }),
                'fixture.png',
            )
            const response = await request('/api/images', owner, { method: 'POST', body: form })
            expect(response.status).toBe(200)
            images.push({
                ...((await response.json()) as Record<string, unknown> & { url: string }),
                id: randomUUID(),
            })
        }
        const metadata = Object.fromEntries(images.map((image) => [image.url, image]))
        const points = images.map((image) => ({
            id: randomUUID(),
            imageId: image.id,
            entryId,
            x: 0.25,
            y: 0.75,
        }))
        const items = [{ id: entryId, itemId: item.id }]
        const response = await request('/api/setups', owner, {
            method: 'POST',
            headers: { 'Idempotency-Key': randomUUID() },
            body: JSON.stringify({
                name: 'Stable image contract',
                items,
                images: images.map((image) => image.url),
                imageMetadata: metadata,
                points,
            }),
        })
        expect(response.status).toBe(200)
        const setup = (await response.json()) as { id: string }
        const edit = async (ordered: typeof images, retainedPoints: typeof points) => {
            const response = await request(`/api/setups/${setup.id}`, owner, {
                method: 'PUT',
                body: JSON.stringify({
                    items,
                    images: ordered.map((image) => image.url),
                    imageMetadata: metadata,
                    points: retainedPoints,
                }),
            })
            expect(response.status).toBe(200)
            return (await (await request(`/api/me/setups/${setup.id}`, owner)).json()) as {
                images: { id: string; position: number }[]
                points: typeof points
            }
        }
        const reordered = await edit([images[1]!, images[0]!], points)
        expect(reordered.images.map((image) => image.id)).toEqual([images[1]!.id, images[0]!.id])
        expect(reordered.points).toEqual(expect.arrayContaining(points))
        const removed = await edit([images[1]!], [points[1]!])
        expect(removed.images).toMatchObject([{ id: images[1]!.id, position: 0 }])
        expect(removed.points).toEqual([points[1]])
    })

    it('retains legal provenance, rejects stale review and fails closed when content is unavailable', async () => {
        const user = await runtime.createUser({ initialLegal: true })
        const status = await request('/api/avatio/legal/status?locale=en', user)
        expect(status.status).toBe(200)
        expect(status.headers.get('cache-control')).toContain('no-store')
        const before = (await status.json()) as {
            needsAgreement: boolean
            documents: { document: string; version: string; sourceRevision: string }[]
        }
        expect(before.needsAgreement).toBe(true)
        expect(JSON.stringify(before)).not.toMatch(/frontmatter|nodes|Markdown/)
        const path = join(runtime.root, 'content/ja/terms.md')
        const original = await readFile(path, 'utf8')
        try {
            await writeFile(path, original.replace('2020-01-01', '2021-01-01'))
            expect(
                (
                    await request('/api/avatio/legal/accept', user, {
                        method: 'POST',
                        body: JSON.stringify({ locale: 'en', documents: before.documents }),
                    })
                ).status,
            ).toBe(409)
            const current = (await (
                await request('/api/avatio/legal/status?locale=en', user)
            ).json()) as typeof before
            const body = JSON.stringify({ locale: 'en', documents: current.documents })
            expect(
                (await request('/api/avatio/legal/accept', user, { method: 'POST', body })).status,
            ).toBe(200)
            expect(
                (await request('/api/avatio/legal/accept', user, { method: 'POST', body })).status,
            ).toBe(200)
            expect(
                await (await request('/api/avatio/legal/status?locale=en', user)).json(),
            ).toMatchObject({ needsAgreement: false })
            const rows = await runtime.db.query.legalAcceptances.findMany({
                where: { userId: user.id },
            })
            expect(rows).toHaveLength(2)
            expect(
                rows.every(
                    (row) => row.sourceLocale === 'ja' && row.sourceRevision.startsWith('sha256:'),
                ),
            ).toBe(true)
            await rename(path, `${path}.unavailable`)
            expect((await request('/api/avatio/legal/status?locale=en', user)).status).toBe(503)
        } finally {
            await writeFile(path, original)
        }
    })
})
