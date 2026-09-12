import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createGithubContentSource } from '@avatio/nuxt/runtime/server/content/github'
import { createLocalContentService } from '@avatio/nuxt/runtime/server/content/local'
import { createAvatioContentService } from '@avatio/nuxt/runtime/server/content/service'
import type { KVNamespace } from '@cloudflare/workers-types'
import kvDriver from 'unstorage/drivers/cloudflare-kv-binding'
import { afterEach, describe, expect, it, vi } from 'vitest'

const markdown = (body = 'Original') =>
    `---\ntitle: Terms\nversion: '2026-01-01'\neffectiveDate: '2026-01-01'\n---\n## Heading\n${body}\n`
const requestUrl = (input: string | URL | Request) =>
    input instanceof Request ? input.url : String(input)
const gitPacket = (text: string) =>
    (new TextEncoder().encode(text).length + 4).toString(16).padStart(4, '0') + text
const gitReferences = (commit: string) =>
    gitPacket('# service=git-upload-pack\n') +
    '0000' +
    gitPacket(`${commit} HEAD\0symref=HEAD:refs/heads/main\n`) +
    gitPacket(`${'c'.repeat(40)} refs/heads/日本語\n`) +
    gitPacket(`${commit} refs/heads/main\n`) +
    '0000'
afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe('comark authored content', () => {
    it('uses filesystem content, shared TOC, and intentional Japanese fallback', async () => {
        const service = createLocalContentService(
            join(process.cwd(), 'content'),
            ['ja', 'en'],
            'ja',
        )
        const page = await service.getPage('terms', 'en')
        expect(page).toMatchObject({
            locale: 'ja',
            requestedLocale: 'en',
            isFallback: true,
            source: {
                path: 'content/ja/terms.md',
                sourceRevision: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
            },
        })
        expect((await service.getPage('faq', 'en'))?.isFallback).toBe(false)
        expect(
            (await service.getPage('faq', 'ja'))?.toc.some((link) => link.text === 'Avatioとは'),
        ).toBe(true)
        expect(await service.getPage('missing', 'en')).toBeNull()
        const metadata = await service.getLegalDocuments('en')
        expect(metadata).toHaveLength(2)
        expect(metadata[0]).not.toHaveProperty('document.nodes')
        expect(JSON.stringify(metadata)).not.toContain('frontmatter')
    })

    it('reads local edits on the next request without generated templates', async () => {
        const directory = await mkdtemp(join(tmpdir(), 'avatio-content-'))
        try {
            await mkdir(join(directory, 'ja'))
            const path = join(directory, 'ja', 'terms.md')
            await writeFile(path, markdown())
            const before = await createLocalContentService(directory, ['ja'], 'ja').getPage(
                'terms',
                'ja',
            )
            await writeFile(path, markdown('Correction'))
            const after = await createLocalContentService(directory, ['ja'], 'ja').getPage(
                'terms',
                'ja',
            )
            expect(after?.source.sourceRevision).not.toBe(before?.source.sourceRevision)
            expect(after?.frontmatter.version).toBe(before?.frontmatter.version)
        } finally {
            await rm(directory, { recursive: true, force: true })
        }
    })

    it('pins the GitHub source to one commit and keeps cached metadata independent of source reads', async () => {
        let commit = 'a'.repeat(40)
        const fetcher = vi.fn(async (input: string | URL | Request) => {
            const url = requestUrl(input)
            if (url.includes('/info/refs?service=git-upload-pack'))
                return new Response(gitReferences(commit))
            if (url.startsWith('https://ungh.cc/') && url.endsWith(`/files/${commit}`))
                return Response.json({
                    files: ['terms', 'privacy-policy'].map((slug) => ({
                        path: `content/ja/${slug}.md`,
                    })),
                })
            if (new URL(url).hostname === 'raw.githubusercontent.com')
                return new Response(markdown(commit))
            throw new Error(`Unexpected content URL: ${url}`)
        })
        vi.stubGlobal('fetch', fetcher)
        const values = new Map<string, string>()
        const writes = new Set<string>()
        const binding = {
            get: vi.fn(async (key: string) => values.get(key) ?? null),
            put: vi.fn(async (key: string, value: string) => {
                if (writes.has(key)) throw new Error(`KV key written twice in one request: ${key}`)
                writes.add(key)
                values.set(key, value)
            }),
            delete: vi.fn(async (key: string) => {
                values.delete(key)
            }),
            list: vi.fn(async () => ({
                keys: [...values.keys()].map((name) => ({ name })),
                list_complete: true,
            })),
        } as unknown as KVNamespace
        const create = () =>
            createAvatioContentService({
                ...createGithubContentSource({
                    repo: 'liria24/avatio',
                    branch: 'main',
                    path: 'content',
                }),
                locales: ['ja', 'en'],
                fallbackLocale: 'ja',
                cache: { driver: kvDriver({ binding }), ttl: 300_000, swr: false },
            })
        const service = create()
        const metadata = await service.getLegalDocuments('en')
        expect(metadata[0]).toMatchObject({ locale: 'ja', sourceCommit: commit })
        const page = await service.getPage('terms', 'en')
        expect(page?.source.sourceRevision).toBe(metadata[0]?.sourceRevision)
        expect(page?.source.sourceUrl).toContain(`/blob/${commit}/content/ja/terms.md`)
        expect(
            fetcher.mock.calls
                .filter(
                    ([url]) => new URL(requestUrl(url)).hostname === 'raw.githubusercontent.com',
                )
                .every(([url]) => requestUrl(url).includes(commit)),
        ).toBe(true)
        fetcher.mockClear()
        await create().getLegalDocuments('en')
        expect(fetcher).not.toHaveBeenCalled()
        expect(values.size).toBeGreaterThan(0)

        for (const [key, value] of values) {
            if (!key.endsWith('manifest')) continue
            const envelope = JSON.parse(value)
            values.set(key, JSON.stringify({ ...envelope, time: 0 }))
        }
        writes.clear()
        commit = 'b'.repeat(40)
        const refreshed = await create().getPage('terms', 'en')
        expect(refreshed?.source.sourceCommit).toBe(commit)
        expect(refreshed?.source.sourceRevision).not.toBe(page?.source.sourceRevision)
        expect(refreshed?.frontmatter.version).toBe(page?.frontmatter.version)

        for (const [key, value] of values) {
            if (key.endsWith('manifest')) continue
            values.set(key, JSON.stringify({ ...JSON.parse(value), time: 0 }))
        }
        writes.clear()
        commit = 'd'.repeat(40)
        const corrected = await create().getPage('terms', 'en')
        expect(corrected?.source.sourceCommit).toBe(commit)
        expect((await create().getLegalDocuments('en'))[0]?.sourceRevision).toBe(
            corrected?.source.sourceRevision,
        )
    })

    it.each(['0003', 'xxxx', '000aabc', gitPacket(`${'a'.repeat(40)} refs/heads/other\n`)])(
        'rejects malformed or missing Git branch advertisements: %s',
        async (advertisement) => {
            vi.stubGlobal(
                'fetch',
                vi.fn(async () => new Response(advertisement)),
            )
            const { source } = createGithubContentSource({
                repo: 'liria24/avatio',
                branch: 'main',
                path: 'content',
            })
            await expect(source.keys()).rejects.toThrow()
        },
    )

    it('fails closed when the content source or persistent cache fails', async () => {
        const source = {
            keys: async () => ['ja/terms.md'],
            getItem: async () => {
                throw new Error('offline')
            },
            getItemRaw: async () => new Uint8Array(),
        }
        const options = {
            source,
            sourceMetadata: () => ({ path: 'content/ja/terms.md' }),
            locales: ['ja'],
            fallbackLocale: 'ja',
        }
        await expect(
            createAvatioContentService({ ...options, cache: false }).getLegalDocuments('ja'),
        ).rejects.toThrow()
        const binding = {
            get: async () => {
                throw new Error('KV unavailable')
            },
        } as unknown as KVNamespace
        await expect(
            createAvatioContentService({
                ...options,
                cache: { driver: kvDriver({ binding }) },
            }).getLegalDocuments('ja'),
        ).rejects.toThrow()
    })
})
