import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { access, mkdir, mkdtemp, readFile, readdir, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createCloudflareConfig } from '../../config/cloudflare.ts'
import { hashCloudflareArtifact } from '../../scripts/cloudflareBuild.ts'
import { readCommittedCloudflareMigrations } from '../../scripts/cloudflareMigrationHistory.ts'
import {
    verifyCloudflareDeploymentHttp,
    verifyCloudflareStaticDeploymentHttp,
} from '../../scripts/cloudflarePreviewSmoke.ts'
import { createCloudflareResourceFixture } from '../helpers/cloudflareResources.ts'

// Build the root application normally. This test never provisions, authenticates or deploys.
const [mode, ...extra] = process.argv.slice(2)
assert.ok(mode === 'development' || mode === 'production', 'An explicit stage is required')
const reuseOutput = extra.length === 1 && extra[0] === '--reuse-output'
assert.ok(extra.length === 0 || reuseOutput, 'Only the test-only --reuse-output option is accepted')
assert.equal(Number(process.versions.node.split('.')[0]), 26)
const projectRoot = fileURLToPath(new URL('../../', import.meta.url))
let root = projectRoot
const inventory = createCloudflareResourceFixture()
const { worker } = createCloudflareConfig({ mode, isPreview: mode === 'development' }, inventory)
const configured = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const installed = (await import('wrangler/package.json', { with: { type: 'json' } })).default
assert.equal(installed.version, '4.147.0')
assert.equal(installed.version, configured.devDependencies.wrangler)
for (const name of Object.keys({ ...configured.dependencies, ...configured.devDependencies }))
    assert.ok(!/cf-beta|build-output-utils/.test(name), `Obsolete fixture dependency: ${name}`)
const temporary = await mkdtemp(join(tmpdir(), 'avatio-cloudflare-application-'))
// Do not pass the caller's environment, home directory, tokens or application secrets to tools.
const cleanEnvironment = {
    PATH: process.env.PATH,
    ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
    HOME: temporary,
    USERPROFILE: temporary,
    XDG_CONFIG_HOME: temporary,
    WRANGLER_SEND_METRICS: 'false',
    CI: 'true',
}
// Normal build-time font downloads use the executor's existing approved proxy.
// None of these settings or caller credentials reach the isolated CLI/runtime.
const proxyNames = [
    'HTTP_PROXY',
    'HTTPS_PROXY',
    'ALL_PROXY',
    'NO_PROXY',
    'http_proxy',
    'https_proxy',
    'all_proxy',
    'no_proxy',
    'NODE_USE_ENV_PROXY',
]
const buildProxy = Object.fromEntries(
    proxyNames.flatMap((name) => (process.env[name] ? [[name, process.env[name]]] : [])),
)
for (const name of Object.keys(process.env)) delete process.env[name]
Object.assign(process.env, cleanEnvironment, buildProxy)
let miniflare
try {
    // CI proves the real platform entrypoint without existing dependencies or Nuxt output.
    // Only synthetic platform metadata/credentials enter this isolated build; it cannot deploy.
    if (!reuseOutput) {
        execFileSync('git', ['diff', '--exit-code', '--quiet', 'HEAD', '--'], {
            cwd: projectRoot,
            env: cleanEnvironment,
        })
        const buildRoot = join(temporary, 'application')
        execFileSync('git', ['worktree', 'add', '--detach', buildRoot, 'HEAD'], {
            cwd: projectRoot,
            env: cleanEnvironment,
            stdio: 'pipe',
        })
        root = buildRoot
        for (const name of ['node_modules', '.nuxt', '.output'])
            await assert.rejects(access(join(root, name)), { code: 'ENOENT' })
        const buildTools = join(temporary, 'build-tools')
        await mkdir(buildTools)
        // Resolve actual platform binaries; a setup-vp shim must not become a build prerequisite.
        for (const name of ['node', 'bun', 'git']) {
            const target =
                name === 'node'
                    ? process.execPath
                    : name === 'bun'
                      ? execFileSync(
                            'bun',
                            ['--no-env-file', '-e', 'process.stdout.write(process.execPath)'],
                            {
                                env: cleanEnvironment,
                                cwd: projectRoot,
                                encoding: 'utf8',
                            },
                        ).trim()
                      : execFileSync('which', [name], {
                            env: cleanEnvironment,
                            encoding: 'utf8',
                        }).trim()
            await symlink(target, join(buildTools, name))
        }
        // Standard POSIX utilities remain available; any preinstalled Vite+ is excluded.
        const buildPath = [buildTools, '/usr/bin', '/bin'].join(delimiter)
        assert.throws(() =>
            execFileSync('/usr/bin/which', ['vp'], {
                env: { ...cleanEnvironment, PATH: buildPath },
                stdio: 'pipe',
            }),
        )
        const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], {
            cwd: root,
            env: cleanEnvironment,
            encoding: 'utf8',
        }).trim()
        execFileSync(
            process.execPath,
            [
                join(
                    root,
                    mode === 'production'
                        ? 'scripts/cloudflareBuilds.ts'
                        : 'scripts/cloudflareDevelopment.ts',
                ),
                'build',
            ],
            {
                cwd: root,
                env: {
                    ...cleanEnvironment,
                    ...buildProxy,
                    PATH: buildPath,
                    ...(mode === 'production'
                        ? {
                              WORKERS_CI: '1',
                              WORKERS_CI_BRANCH: 'main',
                              WORKERS_CI_COMMIT_SHA: sourceSha,
                              WORKERS_CI_BUILD_UUID: '00000000-0000-4000-8000-000000000354',
                              SKIP_DEPENDENCY_INSTALL: '1',
                          }
                        : {
                              GITHUB_ACTIONS: 'true',
                              GITHUB_SERVER_URL: 'https://github.com',
                              GITHUB_REPOSITORY: 'liria24/avatio',
                              GITHUB_EVENT_NAME: 'push',
                              GITHUB_REF: 'refs/heads/development',
                              GITHUB_SHA: sourceSha,
                              GITHUB_RUN_ID: '354',
                              GITHUB_WORKFLOW_REF:
                                  'liria24/avatio/.github/workflows/development.yml@refs/heads/development',
                          }),
                    CLOUDFLARE_API_TOKEN: 'synthetic-platform-token',
                    AVATIO_CF_RESOURCES_JSON: JSON.stringify(inventory),
                },
                stdio: 'inherit',
                timeout: 10 * 60_000,
            },
        )
        for (const name of await readdir(join(root, '.output'), { recursive: true })) {
            try {
                assert.ok(
                    !(await readFile(join(root, '.output', name))).includes(
                        'synthetic-platform-token',
                    ),
                    'Platform deployment credential must not reach the application artifact',
                )
            } catch (error) {
                if (error.code !== 'EISDIR') throw error
            }
        }
    }
    const output = resolve(root, '.output')
    const receipt = JSON.parse(await readFile(join(output, 'delivery.json'), 'utf8'))
    for (const name of proxyNames) delete process.env[name]
    console.log(
        JSON.stringify({
            mode,
            standardNitroBuild: !reuseOutput,
            cleanDeliveryEntrypoint: !reuseOutput,
            publisher: mode === 'production' ? 'Workers Builds' : 'GitHub development push',
            artifactReused: reuseOutput,
            runtimePending: true,
        }),
    )
    assert.deepEqual(JSON.parse(await readFile(join(output, 'delivery.json'), 'utf8')), receipt)
    assert.equal(receipt.stage, mode)
    assert.equal(hashCloudflareArtifact(output), receipt.artifactHash)
    const { validateCloudflareArtifact } = await import('../../scripts/cloudflareDeploy.ts')
    assert.equal(
        validateCloudflareArtifact(output, {
            mode,
            sourceSha: receipt.sourceSha,
            artifactHash: receipt.artifactHash,
            inventory,
        }).name,
        'avatio',
    )
    const server = join(output, 'server')
    const configPath = join(server, 'wrangler.json')
    const generated = JSON.parse(await readFile(configPath, 'utf8'))
    assert.equal(generated.name, 'avatio')
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
    assert.equal(generated.vars.PUBLIC_SITE_URL, inventory[mode].siteUrl)
    assert.equal(generated.vars.R2_PUBLIC_BASE_URL, inventory[mode].imageBaseUrl)
    assert.equal(generated.vars.STAGE, mode)
    assert.equal(generated.d1_databases[0].binding, 'APP_DB')
    assert.equal(generated.d1_databases[0].database_id, inventory[mode].database.id)
    assert.equal(generated.d1_databases[0].migrations_pattern, '../migrations/*/migration.sql')
    assert.equal(generated.d1_databases[0].migrations_table, 'd1_migrations')
    for (const file of readCommittedCloudflareMigrations(root))
        assert.equal(await readFile(join(output, 'migrations', file.name), 'utf8'), file.sql)
    for (const path of ['sw.js', 'manifest.webmanifest']) await access(join(assets, path))
    assert.match(await readFile(join(assets, '_headers'), 'utf8'), /must-revalidate/)
    if (mode === 'development') {
        assert.equal(generated.vars.PREVIEW_NAME, 'development')
        assert.deepEqual(generated.triggers.crons, [])
        assert.deepEqual(generated.queues.producers, [])
        assert.deepEqual(generated.queues.consumers, [])
        assert.deepEqual(generated.send_email, [])
        for (const name of ['EMAIL_FROM', 'OG_IMAGE_SECRET', 'CLOUDFLARE_ANALYTICS_SITE_TAG'])
            assert.equal(generated.vars[name], undefined)
        for (const name of ['EMAIL', 'EMAIL_FROM', 'OG_IMAGE_SECRET', 'ITEM_REVALIDATION_QUEUE'])
            assert.equal(worker.env[name], undefined)
    }
    // Credentialless official dry-run uses exactly Nitro's generated entrypoint and modules.
    const dryRun = execFileSync(
        process.execPath,
        [
            '--import',
            fileURLToPath(new URL('../helpers/runtimeNetwork.mjs', import.meta.url)),
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
    const modules = {}
    // Test-only manifest of unchanged standard Nitro output, not a production repackaging path.
    for (const path of await readdir(server, { recursive: true })) {
        if (!/\.(?:mjs|js|wasm)$/.test(path)) continue
        const name = path.replaceAll('\\', '/')
        modules[name] = {
            type: name.endsWith('.wasm') ? 'wasm' : 'esm',
            contents: await readFile(join(server, path)),
        }
    }
    assert.ok(modules['index.mjs'])
    const secret = randomUUID() + randomUUID()
    const env = Object.fromEntries(
        Object.entries(worker.env).map(([name, binding]) => [
            name,
            binding.type === 'secret' ? { type: 'text', value: secret } : binding,
        ]),
    )
    assert.equal(worker.env.NUXT_BETTER_AUTH_SECRET.type, 'secret')
    assert.equal(worker.env.BETTER_AUTH_SECRET, undefined)
    let outboundAttempts = 0
    const { entrypoint, ...configuration } = worker
    assert.equal(
        relative(root, resolve(root, entrypoint)).replaceAll('\\', '/'),
        '.output/server/index.mjs',
    )
    // Keep runtime-only test dependencies out of memory while Nuxt builds.
    const { Miniflare } = await import('miniflare')
    const { drizzle } = await import('drizzle-orm/d1')
    const { migrate } = await import('drizzle-orm/d1/migrator')
    miniflare = new Miniflare({
        port: 0,
        workers: [
            {
                config: {
                    ...configuration,
                    env,
                    assets: { ...configuration.assets, directory: assets, hasUserWorker: true },
                    manifest: { mainModule: 'index.mjs', modulesRoot: server, modules },
                },
                dev: {
                    outboundService: {
                        type: 'fetcher',
                        handler: () => {
                            outboundAttempts++
                            throw new Error('Isolated application outbound network is forbidden')
                        },
                    },
                },
            },
        ],
    })
    await miniflare.ready
    const database = await miniflare.getD1Database('APP_DB')
    // Only a fresh disposable D1. Populated legacy history is checked by migrations.mjs.
    await migrate(drizzle(database), { migrationsFolder: join(root, 'drizzle') })
    const origin = inventory[mode].siteUrl
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
    if (mode === 'development') {
        for (const method of ['POST', 'DELETE']) {
            const disabled = await request('/api/og-image', {
                method,
                headers: { 'content-type': 'application/json' },
                body: '{}',
            })
            assert.equal(disabled.status, 404)
            await disabled.arrayBuffer()
        }
    }
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
            anonymousAuth: true,
            emailPasswordDisabled: true,
            publicD1: true,
            r2: true,
            outboundAttempts,
            deploymentVerified: false,
        }),
    )
} finally {
    await miniflare?.dispose()
    if (root !== projectRoot)
        execFileSync('git', ['worktree', 'remove', '--force', root], {
            cwd: projectRoot,
            env: cleanEnvironment,
            stdio: 'pipe',
        })
    await rm(temporary, { recursive: true, force: true })
}
