import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { isDeepStrictEqual } from 'node:util'

import { createCloudflareConfig } from '../config/cloudflare.ts'
import { createCloudflareWranglerConfig } from '../config/cloudflareWrangler.ts'
import { parseAvatioStage } from '../config/environment.ts'
import { secretDefinitions } from '../config/secrets.ts'
import { hashCloudflareArtifact } from './cloudflareBuild.ts'
import {
    getCloudflareBuildsContext,
    getCloudflareDevelopmentContext,
} from './cloudflareDeliveryContext.ts'
import { createCloudflareNativeApi } from './cloudflareNativeApi.ts'
import { inspectCloudflarePreviewMetadata } from './cloudflarePreviewMetadata.ts'
import { verifyCloudflareDeploymentHttp } from './cloudflarePreviewSmoke.ts'
import { requireCloudflareQuality } from './cloudflareQuality.ts'

const git = (...args: string[]) =>
    execFileSync('git', args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot },
    }).trim()

/** Data-only artifact validation. The publisher never imports application output/config code. */
export const validateCloudflareArtifact = (
    root: string,
    target: {
        mode: string
        sourceSha: string
        artifactHash: string
        inventory: unknown
    },
) => {
    const stage = parseAvatioStage(target.mode)
    const receipt = JSON.parse(readFileSync(resolve(root, 'delivery.json'), 'utf8'))
    if (
        !/^[a-f0-9]{40}$/.test(target.sourceSha) ||
        !/^[a-f0-9]{64}$/.test(target.artifactHash) ||
        receipt.sourceSha !== target.sourceSha ||
        receipt.stage !== stage ||
        receipt.artifactHash !== target.artifactHash ||
        hashCloudflareArtifact(root) !== target.artifactHash
    )
        throw new Error('Artifact does not match the selected source, target and build digest.')
    const expected = createCloudflareWranglerConfig(stage, target.inventory)
    const generated = JSON.parse(readFileSync(resolve(root, 'server/wrangler.json'), 'utf8'))
    if (
        !isDeepStrictEqual(generated, {
            ...expected,
            main: 'index.mjs',
            assets: { ...expected.assets, binding: 'ASSETS', directory: '../public' },
        })
    )
        throw new Error('Generated configuration differs from the reviewed target.')
    // Compare SQL to the selected immutable Git object, not merely an artifact-supplied digest.
    const paths = git('ls-tree', '-r', '--name-only', target.sourceSha, 'drizzle')
        .split('\n')
        .filter((path) => path.endsWith('/migration.sql'))
        .sort()
    const received = readdirSync(resolve(root, 'migrations'), { recursive: true })
        .map((path) => String(path).replaceAll('\\', '/'))
        .filter((path) => path.endsWith('/migration.sql'))
        .sort()
    if (
        !paths.length ||
        !isDeepStrictEqual(
            paths.map((path) => path.slice(8)),
            received,
        )
    )
        throw new Error('Artifact migrations differ from the committed SQL set.')
    for (const path of paths) {
        const committed = execFileSync('git', ['show', `${target.sourceSha}:${path}`], {
            env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot },
        })
        if (!committed.equals(readFileSync(resolve(root, 'migrations', path.slice(8)))))
            throw new Error('Artifact contains changed migration SQL.')
    }
    for (const path of ['server/index.mjs', 'public/sw.js', 'public/manifest.webmanifest'])
        if (!readFileSync(resolve(root, path)).length)
            throw new Error('Incomplete application artifact.')
    return generated as ReturnType<typeof createCloudflareWranglerConfig> & { main: string }
}

export const requireCurrentCloudflareSource = async (
    mode: string,
    sha: string,
    fetcher: typeof fetch = fetch,
) => {
    const stage = parseAvatioStage(mode)
    if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('An immutable source is required.')
    const branch = stage === 'production' ? 'main' : 'development'
    const response = await fetcher(
        `https://api.github.com/repos/liria24/avatio/branches/${branch}`,
        {
            redirect: 'error',
            signal: AbortSignal.timeout(10_000),
            headers: {
                accept: 'application/vnd.github+json',
            },
        },
    )
    const result = response.ok
        ? ((await response.json()) as { commit?: { sha?: string } })
        : undefined
    if (result?.commit?.sha !== sha)
        throw new Error('Selected branch source is stale or unavailable.')
}

/** Pinned Wrangler's version URL algorithm, using the actual account-owned URL suffix. */
export const getCloudflareProductionVersionOrigin = async (
    accountId: string,
    token: string,
    versionId: string,
    fetcher: typeof fetch = fetch,
) => {
    if (
        !/^[a-f0-9]{32}$/.test(accountId) ||
        !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(versionId)
    )
        throw new Error('Actual production version identity is required.')
    const response = await fetcher(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/workers/avatio`,
        {
            redirect: 'error',
            signal: AbortSignal.timeout(10_000),
            headers: { authorization: `Bearer ${token}` },
        },
    )
    const envelope = response.ok
        ? ((await response.json()) as {
              success?: boolean
              result?: {
                  subdomain?: {
                      previews_enabled?: boolean
                      preview_url_suffix?: string
                  }
              }
          })
        : undefined
    const suffix = envelope?.result?.subdomain?.preview_url_suffix
    if (
        envelope?.success !== true ||
        envelope.result?.subdomain?.previews_enabled !== true ||
        typeof suffix !== 'string' ||
        !/^[.-][a-z0-9.-]+$/.test(suffix)
    )
        throw new Error('Actual production version URL configuration is unavailable.')
    const origin = `https://${versionId.slice(0, 8)}${suffix}`
    if (new URL(origin).origin !== origin)
        throw new Error('Actual version URL must be an HTTPS origin.')
    return origin
}

/** Pinned official CLI only. Bounded errors never echo provider output or credentials. */
const wrangler = (args: string[], env: Record<string, string | undefined>) => {
    try {
        return execFileSync(
            process.execPath,
            [resolve('node_modules/wrangler/bin/wrangler.js'), ...args],
            {
                env,
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'pipe'],
                timeout: 300_000,
                maxBuffer: 8 * 1024 * 1024,
            },
        )
    } catch {
        throw new Error('Pinned Wrangler command failed or did not exit normally.')
    }
}

/** Existing application/resources only. A missing parent must never trigger CLI provisioning. */
export const requireExistingCloudflareTarget = async (
    mode: string,
    inventory: unknown,
    token: string,
    fetcher: typeof fetch = fetch,
) => {
    const stage = parseAvatioStage(mode)
    const expected = createCloudflareConfig(
        { mode: stage, isPreview: stage === 'development' },
        inventory,
    )
    const get = async (path: string) => {
        const response = await fetcher(
            `https://api.cloudflare.com/client/v4/accounts/${expected.accountId}${path}`,
            {
                redirect: 'error',
                signal: AbortSignal.timeout(10_000),
                headers: { authorization: `Bearer ${token}` },
            },
        )
        if (!response.ok) throw new Error('Existing reviewed Cloudflare target is unavailable.')
        const envelope = (await response.json()) as {
            success?: boolean
            result?: Record<string, unknown>
        }
        if (envelope.success !== true || !envelope.result)
            throw new Error('Existing target metadata is incomplete.')
        return envelope.result
    }
    const parent = await get('/workers/workers/avatio')
    const database = expected.worker.env.APP_DB
    if (!database || database.type !== 'd1') throw new Error('Reviewed target database is missing.')
    const observed = await get(`/d1/database/${database.id}`)
    if (observed.uuid !== database.id || observed.name !== database.name)
        throw new Error('Actual migration database differs from the reviewed identity.')
    if (stage === 'development') {
        const preview = await get('/workers/workers/avatio/previews/development')
        if (
            preview.name !== 'development' ||
            typeof preview.id !== 'string' ||
            !/^[\w-]+$/.test(preview.id)
        )
            throw new Error('Existing persistent development Preview is required.')
        const latest = await get('/workers/workers/avatio/previews/development/deployments/latest')
        const env = latest.env as Record<string, { type?: string }> | undefined
        const base = parent.previews_base_config as
            | { env?: Record<string, { type?: string }> }
            | undefined
        // Base inheritance cannot initialize an already-existing Preview. Inspect only names/types.
        if (
            base?.env?.NUXT_BETTER_AUTH_SECRET?.type !== 'secret_text' ||
            env?.NUXT_BETTER_AUTH_SECRET?.type !== 'secret_text' ||
            env?.TWITTER_CLIENT_SECRET?.type !== 'secret_text' ||
            Object.entries(base.env).some(
                ([name, binding]) =>
                    binding.type === 'secret_text' && name !== 'NUXT_BETTER_AUTH_SECRET',
            ) ||
            Object.entries(env).some(
                ([name, binding]) =>
                    binding.type === 'secret_text' &&
                    !['NUXT_BETTER_AUTH_SECRET', 'TWITTER_CLIENT_SECRET'].includes(name),
            )
        )
            throw new Error(
                'Owner-managed Preview secret names/types differ from the required scope.',
            )
        return { previewId: preview.id }
    }
    const settings = await get('/workers/scripts/avatio/settings')
    if (!Array.isArray(settings.bindings))
        throw new Error('Production secret-name inspection is incomplete.')
    const names = new Map(
        settings.bindings.map((binding: { name?: string; type?: string }) => [
            binding.name,
            binding.type,
        ]),
    )
    if (
        Object.entries(expected.worker.env).some(
            ([name, binding]) => binding.type === 'secret' && names.get(name) !== 'secret_text',
        ) ||
        names.has('BETTER_AUTH_SECRET')
    )
        throw new Error(
            'Owner-managed production secret names/types differ from the canonical scope.',
        )
    return {}
}

/** Shared publisher for production Builds and the fixed development push; output is data. */
export const deployCloudflare = async (mode: string, directory: string, sourceSha: string) => {
    let phase = 'inputs'
    try {
        const stage = parseAvatioStage(mode)
        const checkout = {
            sourceSha: git('rev-parse', 'HEAD'),
            clean: git('status', '--porcelain', '--untracked-files=no') === '',
        }
        const context = (
            stage === 'production' ? getCloudflareBuildsContext : getCloudflareDevelopmentContext
        )(process.env, checkout)
        if (
            context.sourceSha !== sourceSha ||
            process.env.AVATIO_NATIVE_DELIVERY_ENABLED !== 'true' ||
            (stage === 'production' && process.env.AVATIO_PRODUCTION_DELIVERY_ENABLED !== 'true') ||
            (stage === 'development' &&
                process.env.AVATIO_DEVELOPMENT_DELIVERY_ENABLED !== 'true') ||
            (stage === 'development' &&
                process.env.AVATIO_DEVELOPMENT_PREVIEW_AUTOBUILD_DISABLED !== 'true') ||
            process.env.AVATIO_MIGRATION_HISTORY_VERIFIED !== 'true' ||
            ['BETTER_AUTH_SECRET', ...secretDefinitions.map(({ key }) => key)].some(
                (name) => process.env[name],
            ) ||
            Object.keys(process.env).some(
                (name) => name.startsWith('DOTENV_PRIVATE_KEY') && process.env[name],
            )
        )
            throw new Error(
                'Reviewed delivery source and migration/recovery acceptance are required.',
            )
        const artifact = resolve(directory)
        const inventory: unknown = JSON.parse(process.env.AVATIO_CF_RESOURCES_JSON ?? '')
        const buildReceipt = JSON.parse(readFileSync(resolve(artifact, 'delivery.json'), 'utf8'))
        phase = 'artifact'
        const config = validateCloudflareArtifact(artifact, {
            mode: stage,
            sourceSha,
            artifactHash: buildReceipt.artifactHash,
            inventory,
        })
        const env = {
            ...process.env,
            GITHUB_SHA: sourceSha,
            CI: 'true',
            CLOUDFLARE_ACCOUNT_ID: config.account_id,
            WRANGLER_SEND_METRICS: 'false',
        }
        const path = resolve(artifact, 'server/wrangler.json')
        // Native Preview D1 migrations are not selected through previews.* by Wrangler.
        // This separate standard config targets that same reviewed database explicitly.
        const state = resolve('.cloudflare/delivery')
        mkdirSync(state, { recursive: true })
        const migrationsPath = resolve(state, 'migrations.json')
        writeFileSync(
            migrationsPath,
            JSON.stringify({
                name: 'avatio',
                account_id: config.account_id,
                d1_databases: config.d1_databases.map((binding) => ({
                    ...binding,
                    migrations_dir: resolve(artifact, 'migrations'),
                    migrations_pattern: `${resolve(artifact, 'migrations').replaceAll('\\', '/')}/*/migration.sql`,
                })),
            }),
        )
        phase = 'quality'
        await requireCloudflareQuality(stage, sourceSha)
        await requireCurrentCloudflareSource(stage, sourceSha)
        phase = 'existing-target'
        const existing = await requireExistingCloudflareTarget(
            stage,
            inventory,
            process.env.CLOUDFLARE_API_TOKEN ?? '',
        )
        phase = 'migration'
        wrangler(
            ['d1', 'migrations', 'apply', 'APP_DB', '--remote', '--config', migrationsPath],
            env,
        )
        phase = 'source-recheck'
        await requireCurrentCloudflareSource(stage, sourceSha)
        const current = await requireExistingCloudflareTarget(
            stage,
            inventory,
            process.env.CLOUDFLARE_API_TOKEN ?? '',
        )
        if (current.previewId !== existing.previewId)
            throw new Error('Persistent Preview parent changed before publication.')
        const outputFile = resolve(state, 'receipt.jsonl')
        const publishEnv = { ...env, WRANGLER_OUTPUT_FILE_PATH: outputFile }
        // Existing parent/Preview and owner-managed secrets are prerequisites. Never use
        // environments, aliases, resource allocation or secret-upload commands here.
        phase = 'publication'
        if (stage === 'development') {
            const result = JSON.parse(
                wrangler(
                    [
                        'preview',
                        '--name',
                        'development',
                        '--worker-name',
                        'avatio',
                        '--config',
                        path,
                        '--json',
                        '--tag',
                        sourceSha,
                        '--message',
                        sourceSha,
                    ],
                    publishEnv,
                ),
            )
            const previewId: unknown = result.preview?.id
            const versionId: unknown = result.deployment?.id
            if (
                typeof previewId !== 'string' ||
                !/^[\w-]{1,128}$/.test(previewId) ||
                typeof versionId !== 'string' ||
                !/^[\w-]{1,128}$/.test(versionId)
            )
                throw new Error('Official Preview deployment identities are incomplete.')
            const returnedUrl: unknown = result.deployment?.urls?.[0]
            let immutableUrl: string | undefined
            if (typeof returnedUrl === 'string') {
                try {
                    const url = new URL(returnedUrl)
                    if (url.protocol === 'https:' && url.origin === returnedUrl)
                        immutableUrl = returnedUrl
                } catch {
                    /* Keep actual IDs even when provider URL metadata is invalid. */
                }
            }
            const receipt = {
                stage,
                sourceSha,
                artifactHash: buildReceipt.artifactHash,
                previewId,
                versionId,
                immutableUrl,
            }
            // Save actual identities immediately after CLI success, before expected
            // parent/origin/binding/source checks or smoke can fail.
            writeFileSync(resolve(state, 'published.json'), JSON.stringify(receipt))
            console.info(JSON.stringify({ publication: receipt }))
            if (
                result.preview?.name !== 'development' ||
                previewId !== existing.previewId ||
                !immutableUrl ||
                !Array.isArray(result.preview.urls) ||
                !result.preview.urls.includes(config.vars.PUBLIC_SITE_URL) ||
                result.preview.urls.includes(immutableUrl)
            )
                throw new Error('Published Preview parent or version URL differs from review.')
            phase = 'verification'
            const audit = inspectCloudflarePreviewMetadata(
                result.deployment.env,
                createCloudflareConfig({ mode: stage, isPreview: true }, inventory).worker.env,
            )
            if (
                !audit.bindingsVerified ||
                result.deployment.annotations?.['workers/commit_sha'] !== sourceSha
            )
                throw new Error('Published Preview source or complete bindings differ from review.')
            const actual = await createCloudflareNativeApi(
                inventory as Parameters<typeof createCloudflareNativeApi>[0],
                process.env.CLOUDFLARE_API_TOKEN ?? '',
            ).deployment(receipt.versionId, receipt.previewId, immutableUrl)
            if (
                !actual?.bindingsVerified ||
                !actual.reviewedUrlPresent ||
                actual.sourceSha !== sourceSha
            )
                throw new Error(
                    'Actual scoped Preview version differs from the official publication receipt.',
                )
            await verifyCloudflareDeploymentHttp(immutableUrl)
            console.info(JSON.stringify({ ...receipt, httpVerified: true }))
        } else {
            wrangler(['deploy', '--config', path, '--message', sourceSha], publishEnv)
            const rows = readFileSync(outputFile, 'utf8')
                .trim()
                .split('\n')
                .map((line) => JSON.parse(line))
            const result = rows.findLast(
                (row) => row.type === 'deploy' && row.worker_name === 'avatio',
            )
            if (!result?.version_id) throw new Error('Official production receipt is incomplete.')
            const receipt = {
                stage,
                sourceSha,
                artifactHash: buildReceipt.artifactHash,
                versionId: result.version_id,
                immutableUrl: undefined as string | undefined,
            }
            writeFileSync(resolve(state, 'published.json'), JSON.stringify(receipt))
            console.info(JSON.stringify({ publication: receipt }))
            phase = 'verification'
            const version = JSON.parse(
                wrangler(['versions', 'view', result.version_id, '--config', path, '--json'], env),
            )
            if (
                version.id !== result.version_id ||
                version.annotations?.['workers/message'] !== sourceSha ||
                version.resources?.script_runtime?.compatibility_date !==
                    config.compatibility_date ||
                !isDeepStrictEqual(
                    version.resources?.script_runtime?.compatibility_flags,
                    config.compatibility_flags,
                )
            )
                throw new Error(
                    'Actual production version differs from the selected source and compatibility settings.',
                )
            const actualBindings = version.resources?.bindings
            if (!Array.isArray(actualBindings))
                throw new Error('Actual production binding metadata is incomplete.')
            const actualEnv = Object.fromEntries(
                actualBindings.map((binding: { name?: string }) => [binding.name, binding]),
            )
            if (
                !inspectCloudflarePreviewMetadata(
                    actualEnv,
                    createCloudflareConfig({ mode: stage, isPreview: false }, inventory).worker.env,
                ).bindingsVerified
            )
                throw new Error('Actual production bindings differ from review.')
            receipt.immutableUrl = await getCloudflareProductionVersionOrigin(
                config.account_id,
                process.env.CLOUDFLARE_API_TOKEN ?? '',
                receipt.versionId,
            )
            writeFileSync(resolve(state, 'published.json'), JSON.stringify(receipt))
            await verifyCloudflareDeploymentHttp(receipt.immutableUrl)
            await verifyCloudflareDeploymentHttp(String(config.vars.PUBLIC_SITE_URL))
            console.info(JSON.stringify({ ...receipt, versionVerified: true, httpVerified: true }))
        }
    } catch {
        console.error(JSON.stringify({ phase, outcome: 'failed' }))
        console.error(
            'Protected Cloudflare delivery stopped. Retain any saved publication receipt; Worker rollback does not roll back D1.',
        )
        throw new Error(`Cloudflare delivery failed at ${phase}.`)
    }
}
