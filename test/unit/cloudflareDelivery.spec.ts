import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'

import { createCloudflareWranglerConfig } from '../../config/cloudflareWrangler'
import { hashCloudflareArtifact } from '../../scripts/cloudflareBuild'
import { deployCloudflare } from '../../scripts/cloudflareDeploy'
import { createCloudflareResourceFixture } from '../helpers/cloudflareResources'

const { execute, quality } = vi.hoisted(() => ({ execute: vi.fn(), quality: vi.fn() }))
vi.mock('node:child_process', () => ({ execFileSync: execute }))
vi.mock('../../scripts/cloudflareQuality.ts', () => ({ requireCloudflareQuality: quality }))

const inventory = createCloudflareResourceFixture()
const sourceSha = 'a'.repeat(40)
const sql = 'SELECT 1;'
const migration = '20260101000000_synthetic/migration.sql'
const address = (value: Parameters<typeof fetch>[0]) =>
    value instanceof Request ? value.url : value instanceof URL ? value.href : value
let root: string
let fetcher: ReturnType<typeof vi.fn<typeof fetch>>

beforeEach(() => {
    execute.mockReset()
    quality.mockReset()
    root = mkdtempSync(join(tmpdir(), 'avatio-delivery-test-'))
    const config = createCloudflareWranglerConfig('development', inventory)
    const files = {
        'server/wrangler.json': JSON.stringify({
            ...config,
            main: 'index.mjs',
            assets: { ...config.assets, binding: 'ASSETS', directory: '../public' },
        }),
        'server/index.mjs': 'synthetic application',
        'public/sw.js': 'synthetic service worker',
        'public/manifest.webmanifest': '{}',
        [`migrations/${migration}`]: sql,
    }
    for (const [name, content] of Object.entries(files)) {
        const path = resolve(root, name)
        mkdirSync(resolve(path, '..'), { recursive: true })
        writeFileSync(path, content)
    }
    writeFileSync(
        resolve(root, 'delivery.json'),
        JSON.stringify({
            stage: 'development',
            sourceSha,
            artifactHash: hashCloudflareArtifact(root),
        }),
    )
    const environment = {
        GITHUB_ACTIONS: 'true',
        GITHUB_SERVER_URL: 'https://github.com',
        GITHUB_REPOSITORY: 'liria24/avatio',
        GITHUB_EVENT_NAME: 'push',
        GITHUB_REF: 'refs/heads/development',
        GITHUB_SHA: sourceSha,
        GITHUB_RUN_ID: '354',
        GITHUB_WORKFLOW_REF:
            'liria24/avatio/.github/workflows/development.yml@refs/heads/development',
        AVATIO_NATIVE_DELIVERY_ENABLED: 'true',
        AVATIO_DEVELOPMENT_DELIVERY_ENABLED: 'true',
        AVATIO_DEVELOPMENT_PREVIEW_AUTOBUILD_DISABLED: 'true',
        AVATIO_MIGRATION_HISTORY_VERIFIED: 'true',
        AVATIO_CF_RESOURCES_JSON: JSON.stringify(inventory),
        CLOUDFLARE_API_TOKEN: 'synthetic-token',
        WORKERS_CI: '',
    }
    for (const [key, value] of Object.entries(environment)) vi.stubEnv(key, value)
    quality.mockResolvedValue({ qualityRunId: 354, sourceSha })
    execute.mockImplementation((command, args) => {
        if (command === 'git') {
            if (args[0] === 'rev-parse') return sourceSha
            if (args[0] === 'status') return ''
            if (args[0] === 'ls-tree') return `drizzle/${migration}`
            if (args[0] === 'show') return Buffer.from(sql)
        }
        throw new Error('Synthetic migration failure')
    })
    fetcher = vi.fn<typeof fetch>(async (url) => {
        const path = address(url)
        if (path.includes('api.github.com')) return Response.json({ commit: { sha: sourceSha } })
        const secret = { type: 'secret_text' }
        const result = path.endsWith('/workers/workers/avatio')
            ? { previews_base_config: { env: { NUXT_BETTER_AUTH_SECRET: secret } } }
            : path.includes('/d1/database/')
              ? {
                    uuid: inventory.development.database.id,
                    name: inventory.development.database.name,
                }
              : path.endsWith('/deployments/latest')
                ? { env: { NUXT_BETTER_AUTH_SECRET: secret, TWITTER_CLIENT_SECRET: secret } }
                : { id: 'existing-preview', name: 'development' }
        return Response.json({ success: true, result })
    })
    vi.stubGlobal('fetch', fetcher)
    vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
    rmSync(root, { recursive: true, force: true })
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

const cliCalls = () => execute.mock.calls.filter(([command]) => command !== 'git')

describe('development migration and publication safety', () => {
    it.each([
        'AVATIO_DEVELOPMENT_DELIVERY_ENABLED',
        'AVATIO_DEVELOPMENT_PREVIEW_AUTOBUILD_DISABLED',
        'AVATIO_MIGRATION_HISTORY_VERIFIED',
    ])('stops before remote access when %s is missing', async (key) => {
        vi.stubEnv(key, '')
        await expect(deployCloudflare('development', root, sourceSha)).rejects.toThrow('inputs')
        expect(fetcher).not.toHaveBeenCalled()
        expect(cliCalls()).toHaveLength(0)
    })
    it('does not publish after migration failure and explicitly targets the reviewed DB', async () => {
        await expect(deployCloudflare('development', root, sourceSha)).rejects.toThrow('migration')
        expect(cliCalls()).toHaveLength(1)
        expect(cliCalls()[0]?.[1].slice(1, 6)).toEqual([
            'd1',
            'migrations',
            'apply',
            'APP_DB',
            '--remote',
        ])
    })
    it('rejects stale source before any migration', async () => {
        fetcher.mockResolvedValueOnce(Response.json({ commit: { sha: 'b'.repeat(40) } }))
        await expect(deployCloudflare('development', root, sourceSha)).rejects.toThrow('quality')
        expect(cliCalls()).toHaveLength(0)
    })
    it('rejects a mismatched actual database before any migration', async () => {
        fetcher.mockResolvedValueOnce(Response.json({ commit: { sha: sourceSha } }))
        fetcher.mockResolvedValueOnce(Response.json({ success: true, result: {} }))
        fetcher.mockResolvedValueOnce(
            Response.json({
                success: true,
                result: {
                    uuid: inventory.production.database.id,
                    name: inventory.production.database.name,
                },
            }),
        )
        await expect(deployCloudflare('development', root, sourceSha)).rejects.toThrow(
            'existing-target',
        )
        expect(cliCalls()).toHaveLength(0)
    })
    it('rechecks source after migration and refuses to publish a now-stale commit', async () => {
        const original = fetcher.getMockImplementation()!
        let checks = 0
        fetcher.mockImplementation(async (url, options) => {
            if (address(url).includes('api.github.com') && ++checks === 2)
                return Response.json({ commit: { sha: 'b'.repeat(40) } })
            return original(url, options)
        })
        const originalExecute = execute.getMockImplementation()!
        execute.mockImplementation((command, args) =>
            command === 'git' ? originalExecute(command, args) : '',
        )
        await expect(deployCloudflare('development', root, sourceSha)).rejects.toThrow(
            'source-recheck',
        )
        expect(cliCalls()).toHaveLength(1)
    })
})
