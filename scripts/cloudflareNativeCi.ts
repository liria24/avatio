import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { appendFileSync, readFileSync, existsSync } from 'node:fs'
import {
    readFile,
    readdir,
    lstat,
    realpath,
    writeFile,
    mkdtemp,
    unlink,
    mkdir,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, relative, isAbsolute, join } from 'node:path'

import { readBuildOutput } from '@cloudflare/build-output-utils'

import { createCloudflareConfig, type CloudflareResourceInventory } from '../config/cloudflare.ts'
import { requireCloudflareActivation } from '../config/cloudflareActivation.ts'
import { createCloudflarePublishPlan } from '../config/cloudflarePublisher.ts'
import { requireCloudflareRecovery } from '../config/cloudflareRecovery.ts'
import { resolveCloudflareDeliveryPreflight } from './cloudflareDeliveryPreflight.ts'
import { createCloudflareNativeApi } from './cloudflareNativeApi.ts'
import { buildCloudflareNative } from './cloudflareNativeBuild.ts'
import {
    publishCloudflareNative,
    cleanupCloudflareNativePr,
    runCloudflareNativeCommand,
    prepareCloudflareRuntimeSecrets,
} from './cloudflareNativePublication.ts'
import { verifyCloudflareDeploymentHttp } from './cloudflarePreviewSmoke.ts'

const object = (value: unknown): Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {}
const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim()
const repository = 'liria24/avatio'
const githubRead = async (path: string): Promise<unknown> => {
    const response = await fetch(`https://api.github.com/repos/${repository}${path}`, {
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
        headers: {
            accept: 'application/vnd.github+json',
            ...(process.env.GITHUB_TOKEN
                ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
                : {}),
        },
    })
    if (!response.ok) throw new Error('Fresh GitHub source evidence is unavailable.')
    return response.json()
}
const selection = async () => {
    if (process.env.GITHUB_REPOSITORY !== repository)
        throw new Error('Trusted repository required.')
    const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH ?? '', 'utf8')) as unknown
    const selected = await resolveCloudflareDeliveryPreflight(
        {
            eventName:
                process.env.GITHUB_EVENT_NAME === 'pull_request_target'
                    ? 'pull_request'
                    : (process.env.GITHUB_EVENT_NAME ?? ''),
            event,
            qualityRunId: process.env.QUALITY_RUN_ID,
        },
        githubRead,
    )
    if (!selected) throw new Error('This event has no authorized native target.')
    const pr = selected.mode.startsWith('pr-')
        ? object(await githubRead(`/pulls/${selected.mode.slice(3)}`))
        : undefined
    const branch = pr
        ? String(object(pr.base).ref)
        : selected.mode === 'production'
          ? 'main'
          : 'development'
    if (!['main', 'development'].includes(branch)) throw new Error('Untrusted base branch.')
    const trustedSha = String(object(object(await githubRead(`/branches/${branch}`)).commit).sha)
    if (!/^[a-f0-9]{40}$/.test(trustedSha)) throw new Error('Immutable trusted code required.')
    const operation = process.env.NATIVE_OPERATION
    if (operation === 'bootstrap' && (!pr || selected.action !== 'deploy'))
        throw new Error('Bootstrap requires a fresh open trusted PR quality run.')
    if (
        operation === 'rollback' &&
        (selected.mode !== 'production' || selected.action !== 'deploy')
    )
        throw new Error('Recovery requires the current successful main quality run.')
    return {
        ...selected,
        action:
            operation === 'bootstrap'
                ? ('bootstrap' as const)
                : operation === 'rollback'
                  ? ('rollback' as const)
                  : selected.action,
        sourceSha: 'sourceSha' in selected ? selected.sourceSha : trustedSha,
        trustedSha,
        trustedRef: `refs/heads/${branch}`,
        sourceRef: pr ? `refs/pull/${selected.mode.slice(3)}/head` : `refs/heads/${branch}`,
    }
}

/** Inspect data files only. Never evaluate a config, import code, or install artifact dependencies. */
export const validateCloudflareNativeArtifact = async (
    directory: string,
    expected: { sourceSha: string; mode: string },
    readCommitted: (name: string) => string,
) => {
    const root = await realpath(directory)
    const visit = async (path: string) => {
        const entry = await lstat(path)
        if (entry.isSymbolicLink()) throw new Error('Build artifact contains a symbolic link.')
        const resolved = await realpath(path)
        const local = relative(root, resolved)
        if (local.startsWith('..') || isAbsolute(local))
            throw new Error('Artifact path escapes its private directory.')
        if (entry.isDirectory())
            for (const name of await readdir(path)) await visit(join(path, name))
        else if (!entry.isFile()) throw new Error('Unexpected artifact file type.')
    }
    await visit(root)
    if (
        (await readdir(root)).some(
            (name) => !['.cloudflare', 'drizzle', 'receipt.json'].includes(name),
        )
    )
        throw new Error(
            'Unexpected artifact contents; no executable tooling or environment files allowed.',
        )
    if (
        existsSync(resolve(root, '.env')) ||
        existsSync(resolve(root, 'package.json')) ||
        existsSync(resolve(root, 'cloudflare.config.ts'))
    )
        throw new Error('Artifact may contain only output, SQL and its receipt.')
    const receipt = object(JSON.parse(await readFile(resolve(root, 'receipt.json'), 'utf8')))
    if (
        receipt.version !== 1 ||
        receipt.sourceSha !== expected.sourceSha ||
        receipt.mode !== expected.mode ||
        receipt.isPreview !== (expected.mode !== 'production') ||
        receipt.workerName !== 'avatio' ||
        !Array.isArray(receipt.migrations)
    )
        throw new Error('Artifact provenance differs from fresh source selection.')
    const names: string[] = []
    for (const value of receipt.migrations) {
        const item = object(value)
        if (typeof item.name !== 'string' || !/^\d{14}_[\w-]+\/migration\.sql$/.test(item.name))
            throw new Error('Invalid committed SQL filename.')
        const sql = await readFile(resolve(root, 'drizzle', item.name), 'utf8')
        const canonical = readCommitted(item.name)
        if (sql !== canonical || item.hash !== createHash('sha256').update(canonical).digest('hex'))
            throw new Error('Artifact SQL differs from the exact source commit.')
        names.push(item.name)
    }
    const output = await readBuildOutput(root)
    for (const worker of Object.values(output.workers)) {
        for (const path of [worker.bundleDir, worker.assetsDir]) {
            if (!path) throw new Error('Output directories are missing.')
            const local = relative(root, await realpath(path))
            if (local.startsWith('..') || isAbsolute(local))
                throw new Error('Output references files outside the build artifact.')
        }
        for (const name of Object.keys(worker.config.manifest?.modules ?? {})) {
            if (isAbsolute(name) || name.includes('\\') || name.split('/').includes('..'))
                throw new Error('Module path escapes the build artifact.')
            const file = await lstat(resolve(worker.bundleDir!, name))
            if (!file.isFile() || file.isSymbolicLink())
                throw new Error('Compiled module is missing or invalid.')
        }
        for (const name of ['sw.js', 'manifest.webmanifest'])
            if (!(await lstat(resolve(worker.assetsDir!, name))).isFile())
                throw new Error('PWA asset is missing.')
    }
    return { output, migrationNames: names }
}

if (import.meta.main) {
    let secretFile: string | undefined
    try {
        const action = process.argv[2]
        const selected = await selection()
        if (action === 'select') {
            if (!process.env.GITHUB_OUTPUT) throw new Error('Actions output destination required.')
            for (const [name, value] of Object.entries({
                mode: selected.mode,
                action: selected.action,
                source_sha: selected.sourceSha,
                trusted_sha: selected.trustedSha,
                trusted_ref: selected.trustedRef,
                environment: selected.mode === 'production' ? 'production' : 'preview',
            }))
                appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`)
        } else {
            const inventory = JSON.parse(
                process.env.AVATIO_CF_RESOURCES_JSON ?? '',
            ) as CloudflareResourceInventory
            const activation = JSON.parse(process.env.AVATIO_CF_ACTIVATION_JSON ?? '') as unknown
            const enabled = process.env.AVATIO_NATIVE_DELIVERY_ENABLED === 'true'
            const expected = {
                action: selected.action,
                mode: selected.mode,
                sourceSha: selected.sourceSha,
                trustedCodeSha: selected.trustedSha,
                inventory,
                enabled,
            }
            const approval = requireCloudflareActivation(activation, expected)
            if (action === 'approve') {
                if (selected.action === 'deploy' && !approval.buildArtifactPublicationApproved)
                    throw new Error('Build artifact metadata handling requires explicit review.')
            } else if (action === 'build') {
                if (
                    selected.action !== 'deploy' ||
                    !approval.buildArtifactPublicationApproved ||
                    git('rev-parse', 'HEAD') !== selected.sourceSha
                )
                    throw new Error(
                        'Credentialless build source was superseded or lacks metadata approval.',
                    )
                await buildCloudflareNative(selected.mode, inventory)
            } else {
                if (
                    git('rev-parse', 'HEAD') !== selected.trustedSha ||
                    git('status', '--porcelain', '--untracked-files=no')
                )
                    throw new Error('Privileged execution requires clean, current trusted code.')
                const api = createCloudflareNativeApi(
                    inventory.accountId,
                    process.env.CLOUDFLARE_API_TOKEN ?? '',
                )
                const state = {
                    branch: null,
                    commit: selected.trustedSha,
                    dirty: false,
                    ci: { ref: selected.trustedRef, commit: selected.trustedSha },
                }
                if (action === 'rollback' && selected.action === 'rollback') {
                    const recovery = requireCloudflareRecovery(
                        JSON.parse(process.env.AVATIO_CF_RECOVERY_JSON ?? ''),
                        {
                            accountId: inventory.accountId,
                            databaseId: inventory.production.database.id,
                            inventory,
                        },
                    )
                    const names = async () =>
                        (
                            await api.query(
                                inventory.production.database.id,
                                'SELECT name FROM d1_migrations ORDER BY id',
                            )
                        ).map((row) => String(object(row).name))
                    if (
                        JSON.stringify(await names()) !==
                        JSON.stringify(recovery.appliedMigrationNames)
                    )
                        throw new Error('Recovery DB differs from the rehearsed migration state.')
                    const configuration = createCloudflareConfig(
                        { mode: 'production', isPreview: false },
                        inventory,
                    )
                    await api.rollbackProductionVersion(recovery.previousVersionId, configuration)
                    await api.verifyProductionVersion(recovery.previousVersionId, configuration)
                    await verifyCloudflareDeploymentHttp(inventory.production.siteUrl)
                    if (
                        JSON.stringify(await names()) !==
                        JSON.stringify(recovery.appliedMigrationNames)
                    )
                        throw new Error(
                            'D1 changed during Worker recovery; stop for private inspection.',
                        )
                } else if (action === 'bootstrap' && selected.action === 'bootstrap') {
                    createCloudflareConfig({ mode: 'production', isPreview: false }, inventory)
                    const resources = await api.bootstrapPr(selected.mode)
                    // Operator retrieves identities privately from Cloudflare, reviews non-production
                    // domains/CORS/integrations and supplies the complete inventory before publishing.
                    await mkdir(resolve('.cloudflare'), { recursive: true })
                    await writeFile(
                        resolve('.cloudflare/bootstrap-result.json'),
                        JSON.stringify(resources),
                        { mode: 0o600 },
                    )
                } else if (action === 'cleanup' && selected.action === 'cleanup') {
                    await cleanupCloudflareNativePr({
                        inventory,
                        activation,
                        enabled,
                        mode: selected.mode,
                        trustedCode: state,
                        trustedRef: selected.trustedRef,
                        trustedSha: selected.trustedSha,
                        api,
                        readPr: () => githubRead(`/pulls/${selected.mode.slice(3)}`),
                    })
                } else if (action === 'deploy' && selected.action === 'deploy') {
                    const artifact = resolve('.cloudflare/native-incoming')
                    // Fetch objects only; never checkout or execute PR code in this job.
                    execFileSync('git', ['fetch', '--no-tags', 'origin', selected.sourceSha], {
                        stdio: 'ignore',
                    })
                    const verified = await validateCloudflareNativeArtifact(
                        artifact,
                        { sourceSha: selected.sourceSha, mode: selected.mode },
                        (name) =>
                            execFileSync('git', ['show', `${selected.sourceSha}:drizzle/${name}`], {
                                encoding: 'utf8',
                            }),
                    )
                    const committedNames = git(
                        'ls-tree',
                        '-r',
                        '--name-only',
                        selected.sourceSha,
                        'drizzle',
                    )
                        .split('\n')
                        .filter((name) => name.endsWith('/migration.sql'))
                        .map((name) => name.slice('drizzle/'.length))
                        .sort()
                    if (JSON.stringify(committedNames) !== JSON.stringify(verified.migrationNames))
                        throw new Error('Artifact omits committed migrations.')
                    const plan = createCloudflarePublishPlan({
                        inventory,
                        buildOutput: verified.output,
                        migrationNames: verified.migrationNames,
                        evidence: {
                            repository,
                            sourceRepository: repository,
                            eventName: selected.mode.startsWith('pr-') ? 'workflow_run' : 'push',
                            ref: selected.sourceRef,
                            mode: selected.mode,
                            sourceSha: selected.sourceSha,
                            latestSourceSha: selected.sourceSha,
                            trustedCodeSha: selected.trustedSha,
                            checkedOutCodeSha: state.commit,
                            trustedCodeRef: selected.trustedRef,
                            state,
                            buildSucceeded: true,
                            build: {
                                sourceSha: selected.sourceSha,
                                mode: selected.mode,
                                isPreview: selected.isPreview,
                                workerName: 'avatio',
                            },
                        },
                    })
                    const secrets = prepareCloudflareRuntimeSecrets(plan, inventory, process.env)
                    if (!plan.isPreview) {
                        const directory = await mkdtemp(join(tmpdir(), 'avatio-runtime-'))
                        secretFile = join(directory, 'secrets.json')
                        await writeFile(secretFile, JSON.stringify(secrets), { mode: 0o600 })
                    }
                    const commandEnv = {
                        PATH: process.env.PATH ?? '',
                        HOME: process.env.HOME ?? '',
                        CI: 'true',
                        CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN ?? '',
                        ...plan.commandEnvironment,
                    }
                    const result = await publishCloudflareNative(plan, {
                        inventory,
                        activation,
                        enabled,
                        trustedCodeSha: selected.trustedSha,
                        runtimeSecrets: secrets,
                        api,
                        latestSourceSha: async () => (await selection()).sourceSha,
                        run: (command) =>
                            runCloudflareNativeCommand(
                                command === plan.deploy && secretFile
                                    ? {
                                          ...command,
                                          args: [...command.args, '--secrets-file', secretFile],
                                      }
                                    : command,
                                artifact,
                                commandEnv,
                            ),
                        verifyProduction: async (value) => {
                            const versionId = String(object(value).versionId)
                            const configuration = createCloudflareConfig(
                                { mode: 'production', isPreview: false },
                                inventory,
                            )
                            await api.verifyProductionVersion(versionId, configuration)
                            const base = new URL(
                                process.env.AVATIO_CF_PRODUCTION_VERSION_BASE ?? '',
                            )
                            if (
                                base.protocol !== 'https:' ||
                                base.origin !== process.env.AVATIO_CF_PRODUCTION_VERSION_BASE ||
                                !/^avatio\.[a-z0-9-]+\.workers\.dev$/.test(base.hostname)
                            )
                                throw new Error('Reviewed production version URL base required.')
                            await verifyCloudflareDeploymentHttp(
                                `https://${versionId.slice(0, 8)}-${base.hostname}`,
                            )
                            await api.verifyProductionVersion(versionId, configuration)
                        },
                    })
                    if (process.env.GITHUB_STEP_SUMMARY)
                        appendFileSync(
                            process.env.GITHUB_STEP_SUMMARY,
                            `Verified ${result.mode} for ${result.sourceSha}.\n${'stableUrl' in result ? `Stable URL: ${result.stableUrl}\nSpecific version: ${result.deploymentUrl}\n` : ''}`,
                        )
                    if ('stableUrl' in result && process.env.GITHUB_OUTPUT)
                        appendFileSync(process.env.GITHUB_OUTPUT, `url=${result.stableUrl}\n`)
                } else throw new Error('Unsupported native CI action.')
            }
            console.info(JSON.stringify({ action, mode: selected.mode, completed: true }))
        }
    } catch {
        console.error(
            'Native operation failed closed. Inspect protected inputs/current resources privately; no automatic DB rollback or legacy deletion is performed.',
        )
        process.exitCode = 1
    } finally {
        if (secretFile) await unlink(secretFile)
    }
}
