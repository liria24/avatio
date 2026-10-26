import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { access, mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { getVoidConfig } from '../../config/void.ts'
import { hashCloudflareArtifact } from '../../scripts/cloudflareBuild.ts'
import {
    verifyCloudflareDeploymentHttp,
    verifyCloudflareStaticDeploymentHttp,
} from '../../scripts/cloudflarePreviewSmoke.ts'
import { createCloudflareProcessEnvironment } from '../../scripts/cloudflareProcessEnvironment.ts'

const [mode, ...extra] = process.argv.slice(2)
assert.ok(mode === 'development' || mode === 'production', 'An explicit stage is required')
const reuseOutput = extra.length === 1 && extra[0] === '--reuse-output'
assert.ok(extra.length === 0 || reuseOutput, 'Only test-only --reuse-output is accepted')
const root = fileURLToPath(new URL('../../', import.meta.url))
const configuration = getVoidConfig(mode).cloudflare
const temporary = await mkdtemp(join(tmpdir(), 'avatio-cloudflare-application-'))
const cleanEnvironment = {
    ...createCloudflareProcessEnvironment(process.env, temporary),
    CI: 'true',
    WRANGLER_SEND_METRICS: 'false',
}
for (const key of [
    'XDG_CONFIG_HOME',
    'XDG_CACHE_HOME',
    'XDG_DATA_HOME',
    'XDG_STATE_HOME',
    'APPDATA',
    'LOCALAPPDATA',
])
    await mkdir(cleanEnvironment[key], { recursive: true })
for (const name of Object.keys(process.env)) delete process.env[name]
Object.assign(process.env, cleanEnvironment)
let miniflare
try {
    if (!reuseOutput)
        execFileSync(process.execPath, ['scripts/cloudflareBuild.ts', mode], {
            cwd: root,
            env: {
                ...cleanEnvironment,
                CLOUDFLARE_API_TOKEN: 'synthetic-platform-token',
                CF_ACCESS_CLIENT_SECRET: 'synthetic-access-token',
            },
            stdio: 'inherit',
            timeout: 10 * 60_000,
        })
    const output = resolve(root, '.output')
    const receipt = JSON.parse(await readFile(join(output, 'delivery.json'), 'utf8'))
    assert.equal(receipt.stage, mode)
    assert.equal(hashCloudflareArtifact(output), receipt.artifactHash)
    const server = join(output, 'server')
    const configPath = join(server, 'wrangler.json')
    const generated = JSON.parse(await readFile(configPath, 'utf8'))
    assert.equal(generated.name, configuration.name)
    assert.equal(generated.compatibility_date, '2026-05-26')
    assert.deepEqual(generated.compatibility_flags, [
        'no_handle_cross_request_promise_resolution',
        'nodejs_compat',
    ])
    assert.equal(generated.no_bundle, true)
    assert.equal(resolve(dirname(configPath), generated.main), join(server, 'index.mjs'))
    const assets = resolve(dirname(configPath), generated.assets.directory)
    assert.equal(assets, join(output, 'public'))
    assert.equal(generated.assets.run_worker_first, true)
    assert.deepEqual(generated.vars, {
        ...configuration.vars,
        AVATIO_SOURCE_SHA: receipt.sourceSha,
    })
    assert.equal(generated.d1_databases[0].database_id, configuration.d1_databases[0].database_id)
    assert.equal(generated.d1_databases[0].binding, 'APP_DB')
    assert.equal(generated.d1_databases[0].migrations_pattern, '../../drizzle/*/migration.sql')
    assert.equal(generated.d1_databases[0].migrations_table, 'd1_migrations')
    assert.equal(generated.preview_urls, false)
    assert.deepEqual(generated.queues, configuration.queues)
    assert.deepEqual(generated.triggers.crons, ['0 22 * * *'])
    assert.deepEqual(generated.send_email, configuration.send_email)
    for (const path of ['sw.js', 'manifest.webmanifest']) await access(join(assets, path))
    assert.match(await readFile(join(assets, '_headers'), 'utf8'), /must-revalidate/)
    for (const path of await readdir(output, { recursive: true, withFileTypes: true })) {
        if (!path.isFile()) continue
        const data = await readFile(join(path.parentPath, path.name))
        assert.ok(
            !data.includes('synthetic-platform-token') && !data.includes('synthetic-access-token'),
            'Build credentials must not reach artifacts',
        )
    }
    const dryRun = execFileSync(
        process.execPath,
        [
            '--import',
            new URL('../helpers/runtimeNetwork.mjs', import.meta.url).href,
            join(root, 'node_modules/wrangler/bin/wrangler.js'),
            'deploy',
            '--dry-run',
            '--config',
            configPath,
            '--outdir',
            join(temporary, 'dry-run'),
        ],
        {
            cwd: temporary,
            env: cleanEnvironment,
            encoding: 'utf8',
            timeout: 120_000,
            maxBuffer: 16 * 1024 * 1024,
        },
    )
    assert.match(dryRun, /dry-run|dry run/i)
    const { unstable_getMiniflareWorkerOptions } = await import('wrangler')
    const { Miniflare, convertV4MiniflareOptions } = await import('miniflare')
    const { drizzle } = await import('drizzle-orm/d1')
    const { migrate } = await import('drizzle-orm/d1/migrator')
    const { workerOptions, externalWorkers } = unstable_getMiniflareWorkerOptions(configPath)
    const files = (await readdir(server, { recursive: true })).filter((path) =>
        /\.(mjs|js|wasm)$/.test(path),
    )
    const modules = ['index.mjs', ...files.filter((path) => path !== 'index.mjs')].map((path) => ({
        path: join(server, path),
        type: path.endsWith('.wasm') ? 'CompiledWasm' : 'ESModule',
    }))
    const secret = randomUUID() + randomUUID()
    let outboundAttempts = 0
    const outboundService = () => {
        outboundAttempts++
        throw new Error('Isolated application outbound network is forbidden')
    }
    miniflare = new Miniflare(
        convertV4MiniflareOptions({
            port: 0,
            d1Persist: false,
            kvPersist: false,
            r2Persist: false,
            workers: [
                {
                    ...workerOptions,
                    modules,
                    modulesRoot: server,
                    modulesRules: undefined,
                    bindings: {
                        ...workerOptions.bindings,
                        ...Object.fromEntries(
                            [
                                'NUXT_BETTER_AUTH_SECRET',
                                'TWITTER_CLIENT_SECRET',
                                'OG_IMAGE_SECRET',
                            ].map((name) => [name, secret]),
                        ),
                    },
                    d1Databases: { APP_DB: 'synthetic-app-db' },
                    kvNamespaces: { CONTENT_CACHE: 'synthetic-content-cache' },
                    r2Buckets: { R2: 'synthetic-images' },
                    outboundService,
                },
                ...externalWorkers.map((worker) => ({ ...worker, outboundService })),
            ],
        }),
    )
    await miniflare.ready
    const database = await miniflare.getD1Database('APP_DB')
    // Only a fresh disposable D1. Populated legacy history is checked by migrations.mjs.
    await migrate(drizzle(database), { migrationsFolder: join(root, 'drizzle') })
    const origin = configuration.vars.PUBLIC_SITE_URL
    const request = (path, options) => miniflare.dispatchFetch(new URL(path, origin), options)
    const fetcher = (url, options) => miniflare.dispatchFetch(url, options)
    const rateLimitsBefore = await database
        .prepare('SELECT COUNT(*) AS count FROM rate_limits')
        .first('count')
    const staticPaths = []
    assert.deepEqual(
        await verifyCloudflareStaticDeploymentHttp(origin, (url, options) => {
            staticPaths.push(new URL(url).pathname)
            return fetcher(url, options)
        }),
        { staticHttpVerified: true, applicationRuntimeVerified: false },
    )
    assert.deepEqual(staticPaths, ['/sw.js', '/manifest.webmanifest'])
    assert.equal(
        await database.prepare('SELECT COUNT(*) AS count FROM rate_limits').first('count'),
        rateLimitsBefore,
    )
    assert.deepEqual(await verifyCloudflareDeploymentHttp(origin, fetcher), { httpVerified: true })
    for (const path of ['/', '/en']) {
        const html = await (await request(path)).text()
        const canonical = [...html.matchAll(/<link\b[^>]*>/g)].filter(([tag]) =>
            /rel="canonical"/.test(tag),
        )
        assert.equal(canonical.length, 1)
        const url = new URL(canonical[0][0].match(/href="([^"]+)"/)[1])
        assert.equal(url.origin, origin)
        assert.equal(url.pathname, path)
        const graphs = [
            ...html.matchAll(
                /<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
            ),
        ]
        assert.ok(graphs.length > 0)
        for (const [, graph] of graphs) assert.ok(JSON.parse(graph)['@context'])
    }
    const robots = await request('/robots.txt')
    assert.equal(robots.status, 200)
    assert.match(await robots.text(), /User-agent:/i)
    const sitemap = await request('/sitemap_index.xml')
    assert.equal(sitemap.status, 200)
    assert.match(await sitemap.text(), /<sitemapindex\b/)
    for (const cookie of [
        undefined,
        'better-auth.session_token=synthetic.invalid',
        '__Secure-better-auth.session_token=synthetic.invalid',
    ]) {
        const headers = cookie ? { cookie } : {}
        const session = await request('/api/auth/get-session', { headers })
        assert.equal(session.status, 200)
        assert.ok(session.headers.get('cache-control')?.includes('no-store'))
        assert.equal(await session.json(), null)
        const protectedResponse = await request('/api/me/setups/fixture', { headers })
        assert.equal(protectedResponse.status, 401)
        assert.ok(!/\bpublic\b/.test(protectedResponse.headers.get('cache-control') ?? ''))
        await protectedResponse.arrayBuffer()
        const items = await request(`/api/items?limit=1&runtime=${randomUUID()}`, { headers })
        assert.equal(items.status, 200)
        assert.ok(items.headers.get('cache-control')?.includes('public'))
        assert.ok(Array.isArray((await items.json()).data))
    }
    const unknown = await request('/en/fixture/unknown/route')
    assert.equal(unknown.status, 404)
    assert.ok(unknown.headers.get('content-type')?.includes('text/html'))
    assert.match(await unknown.text(), /404/)
    for (const path of ['sign-up/email', 'sign-in/email']) {
        const response = await request(`/api/auth/${path}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', origin },
            body: JSON.stringify({
                name: 'Synthetic User',
                username: 'synthetic_user',
                email: 'synthetic@example.test',
                password: `Synthetic-${randomUUID()}`,
            }),
        })
        assert.equal(response.status, 400)
        await response.arrayBuffer()
    }
    assert.equal(await database.prepare('SELECT COUNT(*) AS count FROM users').first('count'), 0)
    assert.equal(await database.prepare('SELECT COUNT(*) AS count FROM sessions').first('count'), 0)
    assert.deepEqual((await database.prepare('PRAGMA foreign_key_check').all()).results, [])
    const bucket = await miniflare.getR2Bucket('R2')
    await bucket.put('isolated-probe', 'synthetic content')
    assert.equal(await (await bucket.get('isolated-probe')).text(), 'synthetic content')
    await bucket.delete('isolated-probe')
    assert.equal(await bucket.get('isolated-probe'), null)
    const worker = await miniflare.getWorker()
    const queueResult = await worker.queue(configuration.queues.consumers[0].queue, [
        {
            id: 'missing-lease',
            timestamp: new Date(),
            attempts: 1,
            body: { version: 2, type: 'catalog.sync-source', sourceId: 'synthetic-source' },
        },
    ])
    assert.ok(queueResult.retryMessages.some((message) => message.msgId === 'missing-lease'))
    assert.ok(!queueResult.explicitAcks.includes('missing-lease'))
    assert.equal((await worker.scheduled({ cron: '0 22 * * *' })).outcome, 'ok')
    const og = await request('/api/og-image', { method: 'DELETE' })
    assert.equal(og.status, 403)
    await og.arrayBuffer()
    assert.equal(outboundAttempts, 0)
    assert.equal(
        hashCloudflareArtifact(output),
        receipt.artifactHash,
        'Dry-run and runtime must not change the deployable artifact',
    )
    console.log(
        JSON.stringify({
            mode,
            standardNitroBuild: !reuseOutput,
            artifactReused: reuseOutput,
            wranglerDryRun: true,
            v2Workerd: true,
            ssr: true,
            pwa: true,
            seo: true,
            anonymousAuth: true,
            emailPasswordDisabled: true,
            publicD1: true,
            r2: true,
            queueLeaseRejected: true,
            cron: true,
            ogAuthorization: true,
            outboundAttempts,
            deploymentVerified: false,
        }),
    )
} finally {
    await miniflare?.dispose()
    await rm(temporary, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
}
