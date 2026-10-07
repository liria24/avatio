import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { appendFile, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

import { readBuildOutput } from '@cloudflare/build-output-utils'
import { drizzle } from 'drizzle-orm/d1'
import { migrate } from 'drizzle-orm/d1/migrator'
import { Miniflare } from 'miniflare'
import { PNG } from 'pngjs'

import {
    verifyCloudflarePreviewHttp,
    verifyCloudflareStaticDeploymentHttp,
} from '../../../scripts/cloudflarePreviewSmoke.ts'

// Real bundled application, local bindings, disposable secrets. Never contact Cloudflare.
const mode = process.argv[2]
const output = await readBuildOutput(process.env.SPIKE_NATIVE_OUTPUT_ROOT ?? process.cwd())
assert.equal(output.rootConfig.buildContext.mode, mode)
const worker = output.workers.default
const { manifest, ...config } = worker.config
assert.ok(manifest)
const modules = Object.fromEntries(
    await Promise.all(
        Object.entries(manifest.modules).map(async ([path, module]) => [
            path,
            {
                type: module.type,
                contents: await readFile(join(worker.bundleDir, path)),
            },
        ]),
    ),
)
const secret = randomUUID() + randomUUID()
const env = Object.fromEntries(
    Object.entries(config.env).map(([key, binding]) => [
        key,
        binding.type === 'secret' ? { type: 'text', value: secret } : binding,
    ]),
)
let outboundAttempts = 0
const miniflare = new Miniflare({
    port: 0,
    workers: [
        {
            config: {
                ...config,
                env,
                assets: { ...config.assets, directory: worker.assetsDir, hasUserWorker: true },
                manifest: {
                    mainModule: manifest.mainModule,
                    modulesRoot: worker.bundleDir,
                    modules,
                },
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
try {
    await miniflare.ready
    const database = await miniflare.getD1Database('APP_DB')
    // Fresh fixture only: does not bridge __alchemy_migrations and d1_migrations.
    await migrate(drizzle(database), { migrationsFolder: resolve('../../../drizzle') })
    const origin = env.SELF_URL.value
    const request = (path, options) => miniflare.dispatchFetch(new URL(path, origin), options)
    if (output.rootConfig.buildContext.isPreview) {
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
    // Inspection must fetch static assets without entering auth or changing its rate-limit rows.
    const rateLimitsBefore = await database
        .prepare('SELECT COUNT(*) AS count FROM rate_limits')
        .first('count')
    const staticPaths = []
    const staticInspection = await verifyCloudflareStaticDeploymentHttp(origin, (url, options) => {
        staticPaths.push(new URL(url).pathname)
        return miniflare.dispatchFetch(url, options)
    })
    assert.deepEqual(staticPaths, ['/sw.js', '/manifest.webmanifest'])
    assert.equal(staticInspection.staticHttpVerified, true)
    assert.equal(staticInspection.applicationRuntimeVerified, false)
    assert.equal(
        await database.prepare('SELECT COUNT(*) AS count FROM rate_limits').first('count'),
        rateLimitsBefore,
    )
    const anonymous = await request('/api/me/setups/fixture')
    assert.equal(anonymous.status, 401)
    const items = await request('/api/items')
    assert.equal(items.status, 200)
    assert.ok(items.headers.get('cache-control')?.includes('public'))
    const unknown = await request('/en/fixture/unknown/route')
    assert.equal(unknown.status, 404)
    assert.ok(unknown.headers.get('content-type')?.includes('text/html'))
    assert.match(await unknown.text(), /404/)
    const bucket = await miniflare.getR2Bucket('R2')
    await bucket.put('isolated-probe', 'synthetic content')
    assert.equal(await (await bucket.get('isolated-probe')).text(), 'synthetic content')
    await bucket.delete('isolated-probe')
    assert.equal(await bucket.get('isolated-probe'), null)
    const signup = (suffix, password = `Synthetic-${randomUUID()}`) =>
        request('/api/auth/sign-up/email', {
            method: 'POST',
            headers: { 'content-type': 'application/json', origin },
            body: JSON.stringify({
                name: `Fixture ${suffix}`,
                username: `fixture_${suffix}`,
                email: `${suffix}@example.test`,
                password,
            }),
        })
    if (output.rootConfig.buildContext.isPreview) {
        // Exercise the delivery verifier against the actual bundled SSR/API/PWA application.
        // Synthetic native URLs only; dispatch remains inside local workerd with denied egress.
        const deploymentId = 'synthetic-ci-version'
        const stableHost = new URL(origin).hostname
        const deploymentUrl = `https://${deploymentId}-${stableHost}`
        const verification = await verifyCloudflarePreviewHttp(
            {
                type: 'preview',
                version: 1,
                preview_id: 'synthetic-preview',
                preview_name: mode,
                preview_slug: mode,
                preview_urls: [origin],
                deployment_id: deploymentId,
                deployment_urls: [deploymentUrl],
            },
            { mode, siteUrl: origin },
            (url, options) => miniflare.dispatchFetch(url, options),
        )
        assert.equal(verification.httpVerified, true)
        assert.equal(verification.realBindingsVerified, false)
        const suffixes = Array.from({ length: 2 }, () =>
            randomUUID().replaceAll('-', '').slice(0, 20),
        )
        const passwords = suffixes.map(() => `Synthetic-${randomUUID()}`)
        const registrations = await Promise.all(
            suffixes.map((suffix, index) => signup(suffix, passwords[index])),
        )
        const cookies = []
        for (const response of registrations) {
            assert.equal(response.status, 200, `Signup status ${response.status}`)
            cookies.push(
                response.headers
                    .getSetCookie()
                    .map((cookie) => cookie.split(';')[0])
                    .join('; '),
            )
        }
        const sessions = await Promise.all(
            cookies.map((cookie) => request('/api/auth/get-session', { headers: { cookie } })),
        )
        for (const [index, response] of sessions.entries()) {
            assert.equal(response.status, 200)
            assert.ok(response.headers.get('cache-control')?.includes('no-store'))
            assert.equal((await response.json()).user.email, `${suffixes[index]}@example.test`)
        }
        const forgedCookie = cookies[0].replace('session_token=', 'session_token=x')
        assert.equal(
            await (
                await request('/api/auth/get-session', {
                    headers: { cookie: forgedCookie },
                })
            ).json(),
            null,
        )
        const png = new PNG({ width: 32, height: 32 })
        for (let i = 0; i < png.data.length; i += 4) {
            png.data[i] = 80
            png.data[i + 1] = 120
            png.data[i + 2] = 200
            png.data[i + 3] = 255
        }
        const form = new FormData()
        form.set('blob', new Blob([PNG.sync.write(png)], { type: 'image/png' }), 'fixture.png')
        form.set('path', 'setup')
        // Miniflare uses its own Fetch classes; serialize Node's multipart body explicitly.
        const multipart = new Response(form)
        const upload = await request('/api/images', {
            method: 'POST',
            headers: {
                cookie: cookies[0],
                origin,
                'content-type': multipart.headers.get('content-type'),
            },
            body: await multipart.arrayBuffer(),
        })
        assert.equal(upload.status, 200)
        const image = await upload.json()
        assert.equal(image.width, 32)
        assert.equal(image.height, 32)
        assert.ok(image.url.startsWith(env.R2_PUBLIC_BASE_URL.value + '/'))
        assert.ok(await bucket.get(image.objectKey))
        assert.equal(
            (await database.prepare('SELECT COUNT(*) AS count FROM users').first()).count,
            2,
        )
        const logout = await request('/api/auth/sign-out', {
            method: 'POST',
            headers: { cookie: cookies[0], origin, 'content-type': 'application/json' },
            body: '{}',
        })
        assert.equal(logout.status, 200)
        assert.equal(
            await (
                await request('/api/auth/get-session?disableCookieCache=true', {
                    headers: { cookie: cookies[0] },
                })
            ).json(),
            null,
        )
        assert.equal(
            (
                await (
                    await request('/api/auth/get-session', { headers: { cookie: cookies[1] } })
                ).json()
            ).user.email,
            `${suffixes[1]}@example.test`,
        )
        const logins = await Promise.all(
            suffixes.map(async (suffix, index) => {
                const response = await request('/api/auth/sign-in/email', {
                    method: 'POST',
                    headers: { origin, 'content-type': 'application/json' },
                    body: JSON.stringify({
                        email: `${suffix}@example.test`,
                        password: passwords[index],
                    }),
                })
                assert.equal(response.status, 200)
                // Consume each stream in its request task, before comparing concurrent results.
                return response.json()
            }),
        )
        for (const [index, login] of logins.entries())
            assert.equal(login.user.email, `${suffixes[index]}@example.test`)
    } else {
        assert.equal((await signup('disabled')).status, 400)
    }
    assert.equal(outboundAttempts, 0)
    console.log(
        JSON.stringify({
            mode,
            v2Workerd: true,
            anonymousAuth: true,
            publicD1: true,
            r2: true,
            previewAuthSessions: output.rootConfig.buildContext.isPreview,
            deploymentVerified: false,
        }),
    )
    if (process.env.GITHUB_STEP_SUMMARY)
        await appendFile(
            process.env.GITHUB_STEP_SUMMARY,
            `v2 actual bundled application executed in isolated workerd for ${mode}: anonymous auth, D1 public API and local R2 verified; PR mode also checks concurrent real signups, signed session isolation and revocation. No remote network. Fresh fixture migrations do not prove populated ledger compatibility, remote bindings, Preview secret scoping or lifecycle.\n`,
        )
} finally {
    await miniflare.dispose()
}
