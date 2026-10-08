import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

import { createCloudflareConfig } from '../../config/cloudflare'
import {
    developmentSchemaSql,
    developmentLedgerSql,
} from '../../scripts/cloudflareDevelopmentLedger'
import { inspectCloudflareDevelopment } from '../../scripts/cloudflareInspectDevelopment'
import { createCloudflareNativeApi } from '../../scripts/cloudflareNativeApi'
import { createCloudflareResourceFixture } from '../helpers/cloudflareResources'

const inventory = createCloudflareResourceFixture()
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
        createCloudflareConfig({ mode: 'development', isPreview: true }, inventory).worker.env,
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
        id: 'patched',
        preview_id: undefined as unknown,
        preview_name: undefined as unknown,
        urls: ['https://patched-development.previews.example.test'],
        env: structuredClone(env),
        annotations: {} as Record<string, string>,
    }
    const fetcher = vi.fn<typeof fetch>(async (url, init) => {
        const path = new URL(
            typeof url === 'string' ? url : url instanceof URL ? url.href : url.url,
        ).pathname
        let result: unknown
        if (path.endsWith('/query')) {
            expect(init?.method).toBe('POST')
            if (typeof init?.body !== 'string') throw new Error('JSON string required')
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

describe('development inspection only', () => {
    it('uses metadata SELECTs and GETs, redacts values, and reports historical lineage as unverified', async () => {
        const { input } = fixture()
        const result = await inspectCloudflareDevelopment(input)
        expect(result).toMatchObject({
            inspectionCodeSha: trusted,
            reviewedHistoricalSourceSha: historical,
            inspectionCodeMatchesHistoricalSource: false,
            bindingsVerified: true,
            sourceProvenanceVerified: false,
            sourceAnnotationMatchesHistoricalSource: false,
            rowsWritten: 0,
            staticHttpVerified: false,
            mutationsExecuted: false,
        })
        expect(result.requiredSecrets.every((secret) => secret.secretTypePresent)).toBe(true)
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
    ])('rejects untrusted contexts before any API call (%j)', async (context) => {
        const { input } = fixture()
        await expect(
            inspectCloudflareDevelopment({ ...input, context: { ...input.context, ...context } }),
        ).rejects.toThrow()
        expect(input.fetcher).not.toHaveBeenCalled()
    })
    it.each(['parent', 'source', 'binding', 'secret', 'url'])(
        'fails closed for unexpected %s and never probes HTTP',
        async (kind) => {
            const { input, deployment } = fixture()
            if (kind === 'parent') deployment.preview_id = 'other'
            if (kind === 'source') deployment.annotations['workers/commit_sha'] = 'c'.repeat(40)
            if (kind === 'binding')
                deployment.env.APP_DB = {
                    type: 'd1',
                    database_id: inventory.production.database.id,
                }
            if (kind === 'secret') delete deployment.env.NUXT_BETTER_AUTH_SECRET
            if (kind === 'url') deployment.urls = ['https://attacker.example.test']
            const httpFetch = vi.fn<typeof fetch>()
            await expect(inspectCloudflareDevelopment({ ...input, httpFetch })).rejects.toThrow()
            expect(httpFetch).not.toHaveBeenCalled()
        },
    )
    it('optional immutable HTTP inspection fetches only static PWA assets, without auth or runtime routes', async () => {
        const { input } = fixture()
        const httpFetch = vi.fn<typeof fetch>(async (url, init) => {
            expect(init?.method).toBe('GET')
            expect(init?.headers).toBeUndefined()
            expect(init?.redirect).toBe('error')
            const path = new URL(
                typeof url === 'string' ? url : url instanceof URL ? url.href : url.url,
            ).pathname
            expect(['/sw.js', '/manifest.webmanifest']).toContain(path)
            return new Response(path.endsWith('webmanifest') ? '{}' : 'self.addEventListener', {
                headers: { 'cache-control': 'must-revalidate' },
            })
        })
        const result = await inspectCloudflareDevelopment({
            ...input,
            httpFetch,
            reviewedImmutableUrl: 'https://patched-development.previews.example.test',
        })
        expect(result).toMatchObject({
            staticHttpVerified: true,
            applicationRuntimeVerified: false,
        })
        expect(httpFetch).toHaveBeenCalledTimes(2)
    })
    it('refuses a stable alias or unreviewed immutable URL before HTTP', async () => {
        const { input } = fixture()
        const httpFetch = vi.fn<typeof fetch>()
        await expect(
            inspectCloudflareDevelopment({
                ...input,
                httpFetch,
                reviewedImmutableUrl: inventory.development.siteUrl,
            }),
        ).rejects.toThrow()
        expect(httpFetch).not.toHaveBeenCalled()
    })
    it('inspects existing development without new shared PR resource IDs or Base settings', async () => {
        const { input } = fixture()
        const { sharedPreviewStorage: _shared, previews: _previews, ...minimal } = input.inventory
        const result = await inspectCloudflareDevelopment({
            ...input,
            inventory: minimal as typeof input.inventory,
        })
        expect(result.sourceProvenanceVerified).toBe(false)
        expect(
            input.fetcher.mock.calls.every(
                ([url]) =>
                    !new URL(url instanceof Request ? url.url : url).pathname.includes(
                        '/previews/pr-',
                    ),
            ),
        ).toBe(true)
    })
    it('never interprets a matching commit annotation as artifact provenance', async () => {
        const { input, deployment } = fixture()
        deployment.annotations['workers/commit_sha'] = historical
        expect(await inspectCloudflareDevelopment(input)).toMatchObject({
            sourceAnnotationMatchesHistoricalSource: true,
            sourceProvenanceVerified: false,
        })
    })
    it('restricts its API capability before fetch even when a future caller attempts mutation or row reads', async () => {
        const { input } = fixture()
        const api = createCloudflareNativeApi(inventory.accountId, input.token, input.fetcher, {
            databaseId: inventory.development.database.id,
            bucket: inventory.development.bucket,
        })
        for (const attempt of [
            () => api.previewBaseBindings(),
            () => api.deletePreview('pr-354', 'reviewed'),
            () => api.query(inventory.development.database.id, 'SELECT * FROM users'),
            () => api.query(inventory.development.database.id, 'DELETE FROM users'),
            () => api.query(inventory.production.database.id, developmentSchemaSql),
        ])
            await expect(attempt()).rejects.toThrow()
        // Every forbidden operation is rejected before fetch.
        expect(input.fetcher.mock.calls.every(([, init]) => init?.method === 'GET')).toBe(true)
    })
    it('requires explicit D1 zero-write metadata and refuses an inconclusive response', async () => {
        for (const rowsWritten of [undefined, 1]) {
            const { input } = fixture()
            const api = createCloudflareNativeApi(
                inventory.accountId,
                input.token,
                async () =>
                    Response.json({
                        success: true,
                        result: [
                            { success: true, results: [], meta: { rows_written: rowsWritten } },
                        ],
                    }),
                {
                    databaseId: inventory.development.database.id,
                    bucket: inventory.development.bucket,
                },
            )
            await expect(
                api.query(inventory.development.database.id, developmentSchemaSql),
            ).rejects.toThrow(/zero/)
        }
    })
    it('keeps inspection workflow manual and development-only with no private dotenv key or publication command', () => {
        const workflow = readFileSync('.github/workflows/native-inspection.yml', 'utf8')
        expect(workflow).toContain('workflow_dispatch:')
        expect(workflow).toContain("github.ref == 'refs/heads/development'")
        expect(workflow).toContain("github.triggering_actor == 'liry24'")
        const caller = readFileSync('.github/workflows/quality.yml', 'utf8')
        expect(caller).toContain('uses: ./.github/workflows/native-inspection.yml')
        expect(caller).toContain('&& inputs.preview_inspection && !inputs.preview_delivery')
        expect(caller).toContain("inputs.preview_inspection && 'inspection'")
        expect(caller).toContain(
            'cancel-in-progress: ${{ !inputs.preview_delivery && !inputs.shared_preview_migrations && !inputs.preview_inspection }}',
        )
        expect(workflow).not.toMatch(
            /DOTENV_PRIVATE_KEY|dotenvx|workflow_run:|push:|pull_request_target:|cloudflareNativeCi.ts|secrets: inherit/,
        )
    })
})

describe('latest Preview response contract diagnostics before normalization or identity rejection', () => {
    const sentinel = 'private-response-secret-never-log'
    const cases = [
        {
            label: 'transport rejection',
            code: 'api-transport-failed',
            shape: { httpResponseReceived: false, jsonParsed: false },
            kind: 'transport',
        },
        {
            label: 'HTTP denial',
            code: 'api-http-failed',
            shape: { httpResponseReceived: true, jsonParsed: false },
            kind: 'http',
        },
        {
            label: 'invalid JSON',
            code: 'api-json-invalid',
            shape: { httpResponseReceived: true, jsonParsed: false },
            kind: 'json',
        },
        {
            label: 'null envelope',
            code: 'api-envelope-shape',
            shape: { envelopeObject: false, jsonParsed: true },
            kind: 'null-envelope',
        },
        {
            label: 'missing success',
            code: 'api-envelope-shape',
            shape: { successPresent: false, successBoolean: false },
            kind: 'missing-success',
        },
        {
            label: 'string success',
            code: 'api-envelope-shape',
            shape: { successPresent: true, successBoolean: false },
            kind: 'string-success',
        },
        {
            label: 'unsuccessful envelope',
            code: 'api-envelope-rejected',
            shape: { successBoolean: true, successTrue: false },
            kind: 'unsuccessful',
        },
        {
            label: 'missing result',
            code: 'api-result-missing',
            shape: { successTrue: true, resultPresent: false },
            kind: 'missing-result',
        },
        {
            label: 'array result',
            code: 'api-deployment-shape',
            shape: { resultPresent: true, resultArray: true, resultObject: false },
            kind: 'array',
        },
        {
            label: 'null result',
            code: 'api-deployment-shape',
            shape: { resultNull: true, resultObject: false },
            kind: 'null',
        },
        {
            label: 'string result',
            code: 'api-deployment-shape',
            shape: { deploymentObject: false, resultObject: false },
            kind: 'string',
        },
        {
            label: 'missing deployment ID',
            code: 'preview-deployment-id-invalid',
            shape: { idPresent: false, idString: false, idValidIdentifier: false },
            kind: 'missing-id',
        },
        {
            label: 'numeric deployment ID',
            code: 'preview-deployment-id-invalid',
            shape: { idPresent: true, idString: false, idValidIdentifier: false },
            kind: 'numeric-id',
        },
        {
            label: 'unsafe deployment ID',
            code: 'preview-deployment-id-invalid',
            shape: { idString: true, idValidIdentifier: false },
            kind: 'unsafe-id',
        },
        {
            label: 'numeric parent ID',
            code: 'preview-parent-id-mismatch',
            shape: { previewIdPresent: true, previewIdString: false },
            kind: 'numeric-parent',
        },
        {
            label: 'different parent ID',
            code: 'preview-parent-id-mismatch',
            shape: { previewIdString: true, previewIdValidIdentifier: true },
            kind: 'different-parent',
        },
        {
            label: 'numeric Preview name',
            code: 'preview-name-mismatch',
            shape: { previewNamePresent: true, previewNameString: false },
            kind: 'numeric-name',
        },
        {
            label: 'different Preview name',
            code: 'preview-name-mismatch',
            shape: { previewNameString: true },
            kind: 'different-name',
        },
        {
            label: 'unsupported nested deployment',
            code: 'preview-deployment-id-invalid',
            shape: { resultObject: true, idPresent: false, previewIdPresent: false },
            kind: 'wrapped',
        },
        {
            label: 'missing URLs',
            code: 'preview-deployment-receipt-mismatch',
            shape: { urlsPresent: false, urlsArray: false },
            kind: 'missing-urls',
        },
        {
            label: 'non-string URL',
            code: 'preview-deployment-receipt-mismatch',
            shape: { urlsPresent: true, urlsArray: true, urlsStrings: false },
            kind: 'numeric-url',
        },
        {
            label: 'array bindings',
            code: 'preview-deployment-receipt-mismatch',
            shape: { envPresent: true, envObject: false },
            kind: 'array-env',
        },
    ]
    it.each(cases)(
        'classifies $label with boolean evidence and no raw response or secret',
        async ({ code, kind, shape }) => {
            const { input, deployment } = fixture()
            const original = input.fetcher.getMockImplementation()!
            input.fetcher.mockImplementation(async (url, init) => {
                const path = new URL(
                    typeof url === 'string' ? url : url instanceof URL ? url.href : url.url,
                ).pathname
                if (!path.endsWith('/deployments/latest')) return original(url, init)
                if (kind === 'transport') throw new Error(sentinel)
                if (kind === 'http') return new Response(sentinel, { status: 403 })
                if (kind === 'json') return new Response(sentinel, { status: 200 })
                if (kind === 'null-envelope') return Response.json(null)
                if (kind === 'missing-success')
                    return Response.json({ result: deployment, secret: sentinel })
                if (kind === 'string-success')
                    return Response.json({ success: 'true', result: deployment, secret: sentinel })
                if (kind === 'unsuccessful')
                    return Response.json({
                        success: false,
                        result: deployment,
                        errors: [{ message: sentinel }],
                    })
                if (kind === 'missing-result')
                    return Response.json({ success: true, secret: sentinel })
                let result: unknown = { ...deployment, private_extension: sentinel }
                if (kind === 'array') result = [deployment, sentinel]
                if (kind === 'null') result = null
                if (kind === 'string') result = sentinel
                if (kind === 'wrapped') result = { deployment, private_extension: sentinel }
                if (result !== null && typeof result === 'object' && !Array.isArray(result)) {
                    const value = result as Record<string, unknown>
                    if (kind === 'missing-id') delete value.id
                    if (kind === 'numeric-id') value.id = 354
                    if (kind === 'unsafe-id') value.id = '../private/secret'
                    if (kind === 'missing-parent') delete value.preview_id
                    if (kind === 'numeric-parent') value.preview_id = 354
                    if (kind === 'different-parent') value.preview_id = 'another-private-parent'
                    if (kind === 'missing-name') delete value.preview_name
                    if (kind === 'numeric-name') value.preview_name = 354
                    if (kind === 'different-name') value.preview_name = 'another-private-preview'
                    if (kind === 'missing-urls') delete value.urls
                    if (kind === 'numeric-url') value.urls = [354]
                    if (kind === 'array-env') value.env = [{ secret: sentinel }]
                }
                return Response.json({ success: true, result })
            })
            const httpFetch = vi.fn<typeof fetch>()
            await expect(inspectCloudflareDevelopment({ ...input, httpFetch })).rejects.toThrow()
            const events = input.reportDiagnostic.mock.calls.map(([event]) => event)
            expect(events).toContainEqual(expect.objectContaining({ outcome: 'failed', code }))
            expect(events).toContainEqual(
                expect.objectContaining({
                    evidence: expect.objectContaining({
                        responseShape: expect.objectContaining(shape),
                    }),
                }),
            )
            expect(JSON.stringify(events)).not.toMatch(
                /private-response-secret|synthetic-do-not-disclose|secret-extension|another-private-parent|another-private-preview/,
            )
            expect(httpFetch).not.toHaveBeenCalled()
            expect(
                input.fetcher.mock.calls.every(
                    ([, init]) =>
                        init?.method === 'GET' ||
                        (init?.method === 'POST' &&
                            typeof init.body === 'string' &&
                            [developmentSchemaSql, developmentLedgerSql].includes(
                                (JSON.parse(init.body) as { sql: string }).sql,
                            )),
                ),
            ).toBe(true)
        },
    )
    it('keeps a genuine 404 as undeployed and explicitly reports the absence status', async () => {
        const { input } = fixture()
        const original = input.fetcher.getMockImplementation()!
        input.fetcher.mockImplementation(async (url, init) => {
            const path = new URL(
                typeof url === 'string' ? url : url instanceof URL ? url.href : url.url,
            ).pathname
            return path.includes('/deployments/')
                ? new Response(null, { status: 404 })
                : original(url, init)
        })
        expect(await inspectCloudflareDevelopment(input)).toMatchObject({
            deploymentPresent: false,
            bindingsVerified: false,
            mutationsExecuted: false,
        })
        expect(input.reportDiagnostic.mock.calls.flat()).toContainEqual({
            phase: 'preview-api-response',
            outcome: 'verified',
            httpStatus: 404,
            evidence: { deploymentPresent: false },
        })
    })
    it('rejects a different exact ID after a valid latest read with explicit comparison evidence', async () => {
        const { input } = fixture()
        await expect(
            inspectCloudflareDevelopment({ ...input, deploymentId: 'reviewed-exact' }),
        ).rejects.toThrow(/preview-exact-id-mismatch/)
        expect(input.reportDiagnostic.mock.calls.flat()).toContainEqual(
            expect.objectContaining({
                phase: 'inspection-exact-read',
                outcome: 'failed',
                code: 'preview-exact-id-mismatch',
                evidence: expect.objectContaining({ exactIdMatches: false }),
            }),
        )
    })
})

describe('observed deployment response without echoed parent identity', () => {
    it('verifies the scoped parent association and exact/latest metadata without inferring historical source provenance', async () => {
        const { input } = fixture()
        const result = await inspectCloudflareDevelopment(input)
        expect(result).toMatchObject({
            deploymentPresent: true,
            bindingsVerified: true,
            sourceProvenanceVerified: false,
            mutationsExecuted: false,
        })
        expect(input.reportDiagnostic.mock.calls.flat()).toContainEqual(
            expect.objectContaining({
                phase: 'preview-api-response',
                evidence: expect.objectContaining({
                    responseShape: expect.objectContaining({
                        previewIdPresent: false,
                        previewNamePresent: false,
                    }),
                }),
            }),
        )
        expect(input.reportDiagnostic.mock.calls.flat()).toContainEqual({
            phase: 'preview-endpoint-association',
            outcome: 'verified',
            evidence: {
                parentMatches: true,
                previewParentStable: true,
                deploymentPresent: true,
                endpointAssociationVerified: true,
            },
        })
    })
    it('rejects a malformed immutable URL despite a verified scoped association', async () => {
        const { input, deployment } = fixture()
        deployment.urls = ['https://production.example.test']
        const httpFetch = vi.fn<typeof fetch>()
        await expect(inspectCloudflareDevelopment({ ...input, httpFetch })).rejects.toThrow(
            /preview-url-contract-mismatch/,
        )
        expect(httpFetch).not.toHaveBeenCalled()
    })
})

describe('complete safe metadata contract audit before rejection', () => {
    it('reports URL, every binding, absent secret types and source conflict together, then runs read-only postflight without HTTP', async () => {
        const { input, deployment } = fixture()
        deployment.id = '12345678-1234-4123-8123-123456789abc'
        deployment.urls = ['https://12345679-avatio.liry.workers.dev']
        deployment.annotations['workers/commit_sha'] = 'c'.repeat(40)
        deployment.env.APP_DB = { type: 'd1', database_id: 'synthetic-private-wrong-id' }
        deployment.env.NUXT_BETTER_AUTH_SECRET = { type: 'secret', text: 'synthetic-never-print' }
        delete deployment.env.TWITTER_CLIENT_SECRET
        const localInventory = structuredClone(inventory)
        localInventory.development.siteUrl = 'https://development-avatio.liry.workers.dev'
        // Text config changes must be reported as booleans, without printing its values.
        const httpFetch = vi.fn<typeof fetch>()
        await expect(
            inspectCloudflareDevelopment({ ...input, inventory: localInventory, httpFetch }),
        ).rejects.toThrow(
            /preview-url-contract-mismatch.*preview-bindings-mismatch.*preview-source-mismatch/,
        )
        const events = input.reportDiagnostic.mock.calls.map(([event]) => event)
        const audit = events.find((event) => event.phase === 'inspection-contract-audit')?.evidence
            ?.contractAudit
        expect(audit).toMatchObject({
            deploymentIdIsUuid: true,
            deploymentId: deployment.id,
            issues: ['url-contract-mismatch', 'bindings-mismatch', 'source-mismatch'],
            urls: [
                {
                    origin: deployment.urls[0],
                    fullDeploymentIdMatches: false,
                    uuidPrefixMatches: false,
                    workerSuffixMatches: true,
                    accountSuffixMatches: true,
                },
            ],
        })
        expect(audit?.bindings).toContainEqual(
            expect.objectContaining({
                name: 'NUXT_BETTER_AUTH_SECRET',
                namePresent: true,
                wire: expect.objectContaining({ fixedType: 'secret' }),
                contractMatches: false,
            }),
        )
        expect(audit?.bindings).toContainEqual(
            expect.objectContaining({
                name: 'TWITTER_CLIENT_SECRET',
                namePresent: false,
                contractMatches: false,
            }),
        )
        expect(audit?.bindings).toHaveLength(
            Object.keys(
                createCloudflareConfig({ mode: 'development', isPreview: true }, localInventory)
                    .worker.env,
            ).length,
        )
        expect(events).toContainEqual({ phase: 'inspection-postflight', outcome: 'verified' })
        expect(httpFetch).not.toHaveBeenCalled()
        expect(JSON.stringify(events)).not.toContain('synthetic-never-print')
        expect(JSON.stringify(events)).not.toContain('synthetic-private-wrong-id')
    })
    it('distinguishes nested/unrecognized env format from verified secret absence without echoing unknown keys or values', async () => {
        const { input, deployment } = fixture()
        deployment.env = {
            bindings: { type: 'synthetic-private-type', text: 'synthetic-secret-value' },
            synthetic_UNREVIEWED_PRIVATE_NAME: {
                type: 'secret_text',
                text: 'synthetic-secret-value',
            },
        }
        await expect(inspectCloudflareDevelopment(input)).rejects.toThrow(
            /preview-bindings-mismatch/,
        )
        const events = input.reportDiagnostic.mock.calls.map(([event]) => event)
        const audit = events.find((event) => event.phase === 'inspection-contract-audit')?.evidence
            ?.contractAudit
        expect(audit).toMatchObject({
            unexpectedBindingCount: 2,
            wireEnv: { bindingsContainerObject: true },
        })
        expect(
            audit?.bindings.every(
                (binding: { namePresent: boolean; contractMatches: boolean }) =>
                    !binding.namePresent && !binding.contractMatches,
            ),
        ).toBe(true)
        const encoded = JSON.stringify(events)
        for (const marker of [
            'synthetic-secret-value',
            'synthetic-private-type',
            'synthetic_UNREVIEWED_PRIVATE_NAME',
        ])
            expect(encoded).not.toContain(marker)
    })
    it('gathers bindings when consistent deployment metadata contains a malformed URL, never emitting arbitrary origins', async () => {
        const { input, deployment } = fixture()
        deployment.urls = [
            'https://synthetic-secret-value@attacker.example.test/private?token=synthetic-secret-value',
        ]
        delete deployment.env.NUXT_BETTER_AUTH_SECRET
        await expect(inspectCloudflareDevelopment(input)).rejects.toThrow(
            /preview-url-contract-mismatch.*preview-bindings-mismatch/,
        )
        const events = input.reportDiagnostic.mock.calls.map(([event]) => event)
        const audit = events.find((event) => event.phase === 'inspection-contract-audit')?.evidence
            ?.contractAudit
        expect(audit?.urls).toEqual([
            expect.objectContaining({ httpsOrigin: false, accountSuffixMatches: false }),
        ])
        expect(audit?.urls[0]).not.toHaveProperty('origin')
        expect(JSON.stringify(events)).not.toContain('synthetic-secret-value')
    })
})

describe('reviewable partial-publication assessment against the current binding contract', () => {
    it('accepts the short UUID URL and recommends a fresh reviewed artifact, without authorizing missing-secret repair or HTTP', async () => {
        const { input, deployment } = fixture()
        const localInventory = structuredClone(inventory)
        localInventory.development.siteUrl = 'https://development-avatio.liry.workers.dev'
        const desired = createCloudflareConfig(
            { mode: 'development', isPreview: true },
            localInventory,
        ).worker.env
        for (const [name, binding] of Object.entries(desired)) {
            if (binding.type === 'text')
                deployment.env[name] = { type: 'plain_text', text: binding.value }
        }
        delete deployment.env.NUXT_BETTER_AUTH_SECRET
        delete deployment.env.TWITTER_CLIENT_SECRET
        deployment.id = '98137eba-5a9a-4d89-894d-9c916ccd8d14'
        deployment.urls = ['https://98137eba-avatio.liry.workers.dev']
        const httpFetch = vi.fn<typeof fetch>()
        await expect(
            inspectCloudflareDevelopment({ ...input, inventory: localInventory, httpFetch }),
        ).rejects.toThrow(/preview-bindings-mismatch/)
        const events = input.reportDiagnostic.mock.calls.map(([event]) => event)
        const audit = events.find((event) => event.phase === 'inspection-contract-audit')?.evidence
            ?.contractAudit
        expect(audit).toMatchObject({
            issues: ['bindings-mismatch'],
            urls: [{ uuidPrefixMatches: true, fullDeploymentIdMatches: false }],
            partialPublication: {
                exactMissingSecretPattern: true,
                matchingNonSecretBindings: 23,
                missingDeclaredSecretNames: expect.arrayContaining([
                    'NUXT_BETTER_AUTH_SECRET',
                    'TWITTER_CLIENT_SECRET',
                ]),
                sourceProvenanceVerified: false,
                secretOnlyRepairAuthorized: false,
                mutationAuthorized: false,
                recommendation: 'fresh-reviewed-artifact-and-explicit-owner-authorization',
            },
        })
        expect(events).toContainEqual({ phase: 'inspection-postflight', outcome: 'verified' })
        expect(httpFetch).not.toHaveBeenCalled()
    })
})
