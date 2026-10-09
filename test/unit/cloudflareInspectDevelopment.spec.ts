import { createHash } from 'node:crypto'

import { getCloudflareDevelopmentInspectionConfiguration } from '../../config/cloudflare'
import {
    developmentSchemaSql,
    developmentLedgerSql,
} from '../../scripts/cloudflareDevelopmentLedger'
import { inspectCloudflareDevelopment } from '../../scripts/cloudflareInspectDevelopment'
import { createCloudflareResourceFixture } from '../helpers/cloudflareResources'

const inventory = createCloudflareResourceFixture()
const address = (value: Parameters<typeof fetch>[0]) =>
    value instanceof Request ? value.url : value instanceof URL ? value.href : value
const trusted = 'b'.repeat(40)
const historical = 'a'.repeat(40)
const sql = 'CREATE TABLE example (id INTEGER PRIMARY KEY)'
const files = [
    {
        name: '20260101000000_first/migration.sql',
        sql,
        hash: createHash('sha256').update(sql).digest('hex'),
    },
]
const schema = [
    {
        type: 'table',
        name: '__alchemy_migrations',
        tableName: '__alchemy_migrations',
        sql: 'CREATE TABLE __alchemy_migrations (id INTEGER PRIMARY KEY, name TEXT, hash TEXT, applied_at TEXT)',
    },
]
const ledger = [
    { id: 1, name: files[0]!.name, hash: files[0]!.hash, appliedAt: '2026-01-01 00:00:00' },
]
const env = Object.fromEntries(
    Object.entries(
        getCloudflareDevelopmentInspectionConfiguration(inventory).configuration.worker.env,
    ).map(([name, binding]) => {
        switch (binding.type) {
            case 'text':
                return [name, { type: 'plain_text', text: binding.value }]
            case 'secret':
                return [
                    name,
                    {
                        type: 'secret_text',
                        text: 'synthetic-do-not-disclose',
                        arbitrary: 'secret-extension',
                    },
                ]
            case 'd1':
                return [name, { type: 'd1', database_id: binding.id }]
            case 'kv':
                return [name, { type: 'kv_namespace', namespace_id: binding.id }]
            case 'r2':
                return [name, { type: 'r2_bucket', bucket_name: binding.name }]
            case 'flagship':
                return [name, { type: 'flagship', id: binding.id }]
            case 'rate-limit':
                return [
                    name,
                    { type: 'ratelimit', namespace_id: binding.namespace, simple: binding.simple },
                ]
            default:
                return [name, { type: binding.type }]
        }
    }),
)
const fixture = () => {
    const deployment = {
        id: 'existing-version',
        env: structuredClone(env),
        urls: ['https://immutable.example.test'],
        annotations: {} as Record<string, string>,
        preview_id: undefined as unknown,
    }
    const fetcher = vi.fn<typeof fetch>(async (url, init) => {
        const path = new URL(address(url)).pathname
        let result: unknown
        if (path.endsWith('/query')) {
            expect(init?.method).toBe('POST')
            if (typeof init?.body !== 'string') throw new Error('Expected JSON request body')
            const body = JSON.parse(init.body) as { sql: string; params: string[] }
            expect([developmentSchemaSql, developmentLedgerSql]).toContain(body.sql)
            expect(body.params).toEqual([])
            result = [
                {
                    success: true,
                    results: body.sql === developmentSchemaSql ? schema : ledger,
                    meta: { rows_written: 0 },
                },
            ]
        } else {
            expect(init?.method).toBe('GET')
            if (path.includes('/deployments/')) result = deployment
            else if (path.endsWith('/previews/development'))
                result = { id: 'reviewed', name: 'development', slug: 'development' }
            else if (path.includes('/d1/database/'))
                result = {
                    uuid: inventory.development.database.id,
                    name: inventory.development.database.name,
                }
            else if (path.endsWith('/storage/kv/namespaces'))
                result = [
                    { id: inventory.development.cache.id, title: inventory.development.cache.name },
                ]
            else if (path.includes('/r2/buckets/')) result = { name: inventory.development.bucket }
            else throw new Error('Unreviewed request')
        }
        return Response.json({ success: true, result })
    })
    return {
        deployment,
        input: {
            context: {
                repository: 'liria24/avatio',
                eventName: 'workflow_dispatch',
                ref: 'refs/heads/development',
                actor: 'liry24',
                triggeringActor: 'liry24',
                trustedCodeSha: trusted,
                currentDevelopmentSha: trusted,
                clean: true,
            },
            historicalSourceSha: historical,
            expectedPreviewId: 'reviewed',
            deploymentId: 'latest',
            inventory,
            files,
            token: 'synthetic-token',
            fetcher,
            reportDiagnostic: vi.fn(),
        },
    }
}

describe('existing development inspection only', () => {
    it('uses only reviewed GETs and fixed SELECTs, emits names/types only, and does not attest historical provenance', async () => {
        const { input } = fixture()
        const result = await inspectCloudflareDevelopment(input)
        expect(result).toMatchObject({
            inspectionCodeSha: trusted,
            reviewedHistoricalSourceSha: historical,
            bindingsVerified: true,
            sourceProvenanceVerified: false,
            rowsWritten: 0,
            staticHttpVerified: false,
            mutationsExecuted: false,
            activationVerified: false,
        })
        expect(result.requiredSecrets.every(({ secretTypePresent }) => secretTypePresent)).toBe(
            true,
        )
        expect(JSON.stringify([result, input.reportDiagnostic.mock.calls])).not.toMatch(
            /synthetic-do-not-disclose|secret-extension|synthetic-token/,
        )
        expect(input.fetcher.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(
            4,
        )
    })
    it.each([
        { actor: 'other' },
        { triggeringActor: 'other' },
        { eventName: 'push' },
        { ref: 'refs/heads/main' },
        { repository: 'fork/avatio' },
        { clean: false },
        { currentDevelopmentSha: historical },
    ])('rejects untrusted manual contexts before API access (%j)', async (context) => {
        const { input } = fixture()
        await expect(
            inspectCloudflareDevelopment({ ...input, context: { ...input.context, ...context } }),
        ).rejects.toThrow()
        expect(input.fetcher).not.toHaveBeenCalled()
    })
    it.each(['parent', 'source', 'database', 'secret', 'extra'])(
        'rejects unexpected %s without HTTP or mutation',
        async (kind) => {
            const { input, deployment } = fixture()
            if (kind === 'parent') deployment.preview_id = 'other'
            if (kind === 'source') deployment.annotations['workers/commit_sha'] = 'c'.repeat(40)
            if (kind === 'database')
                deployment.env.APP_DB = {
                    type: 'd1',
                    database_id: inventory.production.database.id,
                }
            if (kind === 'secret') delete deployment.env.NUXT_BETTER_AUTH_SECRET
            if (kind === 'extra')
                deployment.env.UNREVIEWED_PRIVATE_NAME = {
                    type: 'secret_text',
                    text: 'synthetic-do-not-disclose',
                }
            const httpFetch = vi.fn<typeof fetch>()
            await expect(inspectCloudflareDevelopment({ ...input, httpFetch })).rejects.toThrow()
            expect(httpFetch).not.toHaveBeenCalled()
            expect(JSON.stringify(input.reportDiagnostic.mock.calls)).not.toMatch(
                /synthetic-do-not-disclose|UNREVIEWED_PRIVATE_NAME/,
            )
        },
    )
    it('reports missing required secret names/types and still rechecks unchanged ledger/schema', async () => {
        const { input, deployment } = fixture()
        delete deployment.env.NUXT_BETTER_AUTH_SECRET
        await expect(inspectCloudflareDevelopment(input)).rejects.toThrow(
            /preview-bindings-mismatch/,
        )
        const diagnostics = input.reportDiagnostic.mock.calls.map(([event]) => event)
        expect(diagnostics).toContainEqual(
            expect.objectContaining({
                phase: 'inspection-deployment',
                bindingsVerified: false,
                requiredSecrets: expect.arrayContaining([
                    {
                        name: 'NUXT_BETTER_AUTH_SECRET',
                        type: 'unrecognized-or-absent',
                        secretTypePresent: false,
                    },
                ]),
            }),
        )
        expect(diagnostics).toContainEqual({ phase: 'inspection-postflight', outcome: 'verified' })
    })
    it('fetches only static PWA files from the reviewed origin exactly present in scoped metadata', async () => {
        const { input } = fixture()
        const httpFetch = vi.fn<typeof fetch>(async (url, init) => {
            expect(init?.method).toBe('GET')
            expect(init?.headers).toBeUndefined()
            expect(init?.redirect).toBe('error')
            const path = new URL(address(url)).pathname
            expect(['/sw.js', '/manifest.webmanifest']).toContain(path)
            return new Response(path.endsWith('webmanifest') ? '{}' : 'self.addEventListener', {
                headers: { 'cache-control': 'must-revalidate' },
            })
        })
        const result = await inspectCloudflareDevelopment({
            ...input,
            httpFetch,
            reviewedImmutableUrl: 'https://immutable.example.test',
        })
        expect(result.staticHttpVerified).toBe(true)
        expect(result.applicationRuntimeVerified).toBe(false)
        expect(httpFetch).toHaveBeenCalledTimes(2)
    })
    it.each([
        'https://attacker.example.test',
        inventory.development.siteUrl,
        'http://immutable.example.test',
        'https://token@immutable.example.test',
    ])(
        'does not fetch an invalid, stable or unobserved reviewed origin (%s)',
        async (reviewedImmutableUrl) => {
            const { input } = fixture()
            const httpFetch = vi.fn<typeof fetch>()
            await expect(
                inspectCloudflareDevelopment({ ...input, httpFetch, reviewedImmutableUrl }),
            ).rejects.toThrow()
            expect(httpFetch).not.toHaveBeenCalled()
        },
    )
    it('requires an explicit reviewed Preview identity before resource access', async () => {
        const { input } = fixture()
        await expect(
            inspectCloudflareDevelopment({ ...input, expectedPreviewId: '' }),
        ).rejects.toThrow()
        expect(input.fetcher).not.toHaveBeenCalled()
    })
})
