import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

import { createCloudflareWranglerConfig } from '../../config/cloudflareWrangler'
import { hashCloudflareArtifact } from '../../scripts/cloudflareBuild'
import {
    validateCloudflareArtifact,
    requireCurrentCloudflareSource,
    requireExistingCloudflareTarget,
    getCloudflareProductionVersionOrigin,
} from '../../scripts/cloudflareDeploy'
import { readCommittedCloudflareMigrations } from '../../scripts/cloudflareMigrationHistory'
import { createCloudflareResourceFixture } from '../helpers/cloudflareResources'

const inventory = createCloudflareResourceFixture()
const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const configuration = (mode: string) => ({
    ...createCloudflareWranglerConfig(mode, inventory),
    main: 'index.mjs',
    assets: { run_worker_first: true, binding: 'ASSETS', directory: '../public' },
})

describe('standard two-target Wrangler configuration', () => {
    it('preserves production bindings, compatibility, domain, Cron and Queue', () => {
        const config = configuration('production')
        expect(config.name).toBe('avatio')
        expect(config.compatibility_flags).toEqual([
            'no_handle_cross_request_promise_resolution',
            'nodejs_compat',
        ])
        expect(config.compatibility_date).toBe('2026-05-26')
        expect(config.routes).toEqual([{ pattern: 'avatio.me', custom_domain: true }])
        expect(config.triggers.crons).toEqual(['0 22 * * *'])
        expect(config.queues).toEqual({
            producers: [{ binding: 'ITEM_REVALIDATION_QUEUE', queue: 'item-revalidation' }],
            consumers: [
                {
                    queue: 'item-revalidation',
                    max_batch_size: 10,
                    max_batch_timeout: 5,
                    max_retries: 3,
                },
            ],
        })
        expect(config.secrets.required).toEqual(
            expect.arrayContaining([
                'NUXT_BETTER_AUTH_SECRET',
                'TWITTER_CLIENT_SECRET',
                'OG_IMAGE_SECRET',
            ]),
        )
        expect(config.ratelimits).toHaveLength(4)
        expect(config.no_bundle).toBe(true)
        expect(config.previews).toBeUndefined()
    })
    it('uses one persistent native Preview with reviewed non-production bindings only', () => {
        const config = configuration('development')
        expect(config.name).toBe('avatio')
        expect(config.previews?.vars.PREVIEW_NAME).toBe('development')
        expect(Object.hasOwn(config.previews ?? {}, 'secrets')).toBe(false)
        expect(config.previews?.d1_databases).toEqual(config.d1_databases)
        expect(config.d1_databases).toEqual([
            expect.objectContaining({
                database_id: inventory.development.database.id,
                database_name: 'avatio-development',
                migrations_dir: '../migrations',
                migrations_pattern: '../migrations/*/migration.sql',
                migrations_table: 'd1_migrations',
            }),
        ])
        expect(config.queues).toEqual({ producers: [], consumers: [] })
        expect(config.triggers.crons).toEqual([])
        expect(config.send_email).toEqual([])
        expect(config.routes).toEqual([])
        expect(config.secrets.required).toEqual([
            'NUXT_BETTER_AUTH_SECRET',
            'TWITTER_CLIENT_SECRET',
        ])
        expect(JSON.stringify(config)).not.toContain(inventory.production.database.id)
        expect(() => configuration('pr-354')).toThrow()
    })
})

describe('data-only matching artifact', () => {
    let root: string
    beforeEach(() => {
        root = mkdtempSync(resolve(tmpdir(), 'avatio-artifact-'))
        const write = (path: string, contents: string) => {
            const destination = resolve(root, path)
            mkdirSync(resolve(destination, '..'), { recursive: true })
            writeFileSync(destination, contents)
        }
        write('server/wrangler.json', JSON.stringify(configuration('development')))
        write('server/index.mjs', 'throw new Error("Artifact code must never execute")')
        write('public/sw.js', 'synthetic service worker')
        write('public/manifest.webmanifest', '{}')
        for (const file of readCommittedCloudflareMigrations())
            write(`migrations/${file.name}`, file.sql)
        const artifactHash = hashCloudflareArtifact(root)
        write('delivery.json', JSON.stringify({ sourceSha, stage: 'development', artifactHash }))
    })
    afterEach(() => rmSync(root, { recursive: true, force: true }))
    const validate = (overrides = {}) =>
        validateCloudflareArtifact(root, {
            mode: 'development',
            sourceSha,
            artifactHash: hashCloudflareArtifact(root),
            inventory,
            ...overrides,
        })
    it('reads JSON and hashes files without executing artifact modules', () => {
        expect(validate().name).toBe('avatio')
    })
    it.each([
        { mode: 'production' },
        { mode: 'pr-354' },
        { sourceSha: 'b'.repeat(40) },
        { artifactHash: 'c'.repeat(64) },
    ])('rejects source/target/digest mismatch %j', (override) => {
        expect(() => validate(override)).toThrow()
    })
    it('rejects changed assets, even if the receipt still names the original source', () => {
        writeFileSync(resolve(root, 'public/sw.js'), 'changed')
        expect(() => validate()).toThrow()
    })
    it('rejects executable config hooks even when every artifact hash is recomputed', () => {
        const path = resolve(root, 'server/wrangler.json')
        writeFileSync(
            path,
            JSON.stringify({
                ...JSON.parse(readFileSync(path, 'utf8')),
                build: { command: 'untrusted hook' },
            }),
        )
        writeFileSync(
            resolve(root, 'delivery.json'),
            JSON.stringify({
                sourceSha,
                stage: 'development',
                artifactHash: hashCloudflareArtifact(root),
            }),
        )
        expect(() => validate()).toThrow('reviewed target')
    })
    it('rejects symlinks and environment files before any publisher invocation', () => {
        symlinkSync(resolve(root, 'public/sw.js'), resolve(root, 'public/link.js'))
        expect(() => hashCloudflareArtifact(root)).toThrow('symlinks')
        rmSync(resolve(root, 'public/link.js'))
        writeFileSync(resolve(root, 'public/.env.production'), 'synthetic')
        expect(() => hashCloudflareArtifact(root)).toThrow('Environment files')
    })
})

describe('fresh source and existing target guard', () => {
    it('uses the authoritative Worker version URL suffix, independent of workers.dev routing', async () => {
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
            Response.json({
                success: true,
                result: {
                    subdomain: {
                        enabled: false,
                        previews_enabled: true,
                        preview_url_suffix: '-avatio.reviewed.workers.dev',
                    },
                },
            }),
        )
        await expect(
            getCloudflareProductionVersionOrigin(
                inventory.accountId,
                'synthetic-token',
                '12345678-1234-4234-8234-123456789abc',
                fetcher,
            ),
        ).resolves.toBe('https://12345678-avatio.reviewed.workers.dev')
        expect(fetcher.mock.calls[0]?.[0]).toBe(
            `https://api.cloudflare.com/client/v4/accounts/${inventory.accountId}/workers/workers/avatio`,
        )
    })
    it.each([
        {
            enabled: true,
            previews_enabled: false,
            preview_url_suffix: '-avatio.reviewed.workers.dev',
        },
        { previews_enabled: true },
        { previews_enabled: true, preview_url_suffix: '//unsafe.example/path' },
    ])('rejects unavailable or malformed actual version URLs %j', async (subdomain) => {
        await expect(
            getCloudflareProductionVersionOrigin(
                inventory.accountId,
                'synthetic-token',
                '12345678-1234-4234-8234-123456789abc',
                vi
                    .fn<typeof fetch>()
                    .mockResolvedValue(Response.json({ success: true, result: { subdomain } })),
            ),
        ).rejects.toThrow()
    })
    it.each(['production', 'development'])('checks the actual current %s branch', async (mode) => {
        const fetcher = vi
            .fn<typeof fetch>()
            .mockResolvedValue(Response.json({ commit: { sha: sourceSha } }))
        await requireCurrentCloudflareSource(mode, sourceSha, fetcher)
        expect(fetcher.mock.calls[0]?.[0]).toBe(
            `https://api.github.com/repos/liria24/avatio/branches/${mode === 'production' ? 'main' : 'development'}`,
        )
    })
    it('rejects stale or unavailable source', async () => {
        await expect(
            requireCurrentCloudflareSource(
                'development',
                sourceSha,
                vi
                    .fn<typeof fetch>()
                    .mockResolvedValue(Response.json({ commit: { sha: 'b'.repeat(40) } })),
            ),
        ).rejects.toThrow()
        await expect(
            requireCurrentCloudflareSource(
                'development',
                sourceSha,
                vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 403 })),
            ),
        ).rejects.toThrow()
    })
    it('rejects an absent parent instead of permitting Wrangler to provision it', async () => {
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 404 }))
        await expect(
            requireExistingCloudflareTarget('development', inventory, 'synthetic-token', fetcher),
        ).rejects.toThrow()
        expect(fetcher).toHaveBeenCalledTimes(1)
        expect(fetcher.mock.calls[0]?.[1]?.method).toBeUndefined()
    })
    it('requires canonical secrets in both existing Preview and Base, Twitter only in Preview', async () => {
        const canonical = { type: 'secret_text' }
        const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url) => {
            const path = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url
            const result = path.endsWith('/workers/workers/avatio')
                ? { previews_base_config: { env: { NUXT_BETTER_AUTH_SECRET: canonical } } }
                : path.includes('/d1/database/')
                  ? {
                        uuid: inventory.development.database.id,
                        name: inventory.development.database.name,
                    }
                  : path.endsWith('/deployments/latest')
                    ? {
                          env: {
                              NUXT_BETTER_AUTH_SECRET: canonical,
                              TWITTER_CLIENT_SECRET: canonical,
                          },
                      }
                    : { id: 'existing-preview', name: 'development' }
            return Response.json({ success: true, result })
        })
        await expect(
            requireExistingCloudflareTarget('development', inventory, 'synthetic-token', fetcher),
        ).resolves.toEqual({ previewId: 'existing-preview' })
        fetcher.mockResolvedValueOnce(
            Response.json({
                success: true,
                result: {
                    previews_base_config: {
                        env: {
                            NUXT_BETTER_AUTH_SECRET: canonical,
                            TWITTER_CLIENT_SECRET: canonical,
                        },
                    },
                },
            }),
        )
        await expect(
            requireExistingCloudflareTarget('development', inventory, 'synthetic-token', fetcher),
        ).rejects.toThrow('scope')
    })
})
