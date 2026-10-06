import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

import { validateCloudflareNativeArtifact } from '../../scripts/cloudflareNativeCi'

const roots: string[] = []
const sha = 'a'.repeat(40)
const create = async (patch: Record<string, unknown> = {}) => {
    const root = await mkdtemp(resolve(tmpdir(), 'avatio-native-artifact-'))
    roots.push(root)
    await writeFile(
        resolve(root, 'receipt.json'),
        JSON.stringify({
            version: 1,
            sourceSha: sha,
            mode: 'pr-354',
            isPreview: true,
            workerName: 'avatio',
            migrations: [],
            ...patch,
        }),
    )
    return root
}
afterEach(async () => {
    for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true })
})
describe('untrusted Build Output handoff', () => {
    it.each([
        { sourceSha: 'b'.repeat(40) },
        { mode: 'production' },
        { isPreview: false },
        { workerName: 'avatio-development' },
    ])('rejects wrong provenance before reading bundle metadata (%j)', async (patch) => {
        const root = await create(patch)
        await expect(
            validateCloudflareNativeArtifact(root, { sourceSha: sha, mode: 'pr-354' }, () => {
                throw new Error('No SQL expected')
            }),
        ).rejects.toThrow(/provenance/)
    })
    it.each(['.env', 'package.json', 'cloudflare.config.ts', 'setup.mjs'])(
        'never accepts executable tooling/credential file %s from a build',
        async (name) => {
            const root = await create()
            await writeFile(resolve(root, name), 'throw new Error("artifact code must never run")')
            await expect(
                validateCloudflareNativeArtifact(
                    root,
                    { sourceSha: sha, mode: 'pr-354' },
                    () => '',
                ),
            ).rejects.toThrow(/contents/)
        },
    )
    it('rejects path traversal before opening SQL outside the artifact', async () => {
        const root = await create({
            migrations: [{ name: '../../unrelated.sql', hash: 'a'.repeat(64) }],
        })
        const read = vi.fn(() => '')
        await expect(
            validateCloudflareNativeArtifact(root, { sourceSha: sha, mode: 'pr-354' }, read),
        ).rejects.toThrow(/filename/)
        expect(read).not.toHaveBeenCalled()
    })
    it('rejects a changed SQL body even when the source SHA matches', async () => {
        const name = '20260801000000_initial/migration.sql'
        const root = await create({ migrations: [{ name, hash: 'a'.repeat(64) }] })
        await mkdir(resolve(root, 'drizzle', '20260801000000_initial'), { recursive: true })
        await writeFile(resolve(root, 'drizzle', name), 'DROP TABLE users;')
        await expect(
            validateCloudflareNativeArtifact(
                root,
                { sourceSha: sha, mode: 'pr-354' },
                () => 'CREATE TABLE users(id TEXT);',
            ),
        ).rejects.toThrow(/exact source/)
    })
})
