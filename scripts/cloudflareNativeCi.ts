import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { appendFileSync, readFileSync, existsSync, writeFileSync } from 'node:fs'
import { readFile, readdir, lstat, realpath, mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, relative, isAbsolute, join } from 'node:path'

import { readBuildOutput } from '@cloudflare/build-output-utils'

import type { CloudflareResourceInventory } from '../config/cloudflare.ts'
import { createCloudflarePublishPlan } from '../config/cloudflarePublisher.ts'
import { resolveCloudflareDeliveryPreflight } from './cloudflareDeliveryPreflight.ts'
import { readCommittedCloudflareMigrations } from './cloudflareMigrationHistory.ts'
import { createCloudflareNativeApi } from './cloudflareNativeApi.ts'
import { buildCloudflareNative } from './cloudflareNativeBuild.ts'
import { nativePhase, type NativeReporter } from './cloudflareNativeDiagnostics.ts'
import {
    publishCloudflareNative,
    migrateCloudflareSharedPreview,
    cleanupCloudflareNativePr,
    runCloudflareNativeCommand,
} from './cloudflareNativePublication.ts'

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
    if (selected.mode === 'production') throw new Error('Production cutover remains on hold.')
    if (
        process.env.NATIVE_OPERATION &&
        !['deploy', 'migrate-shared'].includes(process.env.NATIVE_OPERATION)
    )
        throw new Error('Unsupported native operation.')
    const manualDevelopmentApproved =
        process.env.GITHUB_EVENT_NAME === 'workflow_dispatch' &&
        process.env.GITHUB_REF === 'refs/heads/development' &&
        selected.mode === 'development' &&
        process.env.GITHUB_ACTOR === 'liry24' &&
        process.env.GITHUB_TRIGGERING_ACTOR === 'liry24'
    if (process.env.GITHUB_EVENT_NAME === 'workflow_dispatch' && !manualDevelopmentApproved)
        throw new Error('Manual Preview delivery requires the owner and development branch.')
    if (process.env.AVATIO_NATIVE_DELIVERY_ENABLED !== 'true' && !manualDevelopmentApproved)
        throw new Error('Native automatic delivery remains disabled.')
    const migrateShared = process.env.NATIVE_OPERATION === 'migrate-shared'
    if (
        migrateShared &&
        (!manualDevelopmentApproved ||
            selected.action !== 'deploy' ||
            !('sourceSha' in selected) ||
            selected.sourceSha !== trustedSha)
    )
        throw new Error(
            'Shared migration requires an owner manual run of the current trusted base.',
        )
    return {
        ...selected,
        action: migrateShared ? ('migrate-shared' as const) : selected.action,
        sourceSha: 'sourceSha' in selected ? selected.sourceSha : trustedSha,
        trustedSha,
        trustedRef: `refs/heads/${branch}`,
        sourceRef: pr ? `refs/pull/${selected.mode.slice(3)}/head` : `refs/heads/${branch}`,
        manualDevelopmentApproved,
        qualityRunId: process.env.QUALITY_RUN_ID ?? '',
    }
}

/** Inspect data files only. Never evaluate a config, import code, or install artifact dependencies. */
export const validateCloudflareNativeArtifact = async (
    directory: string,
    expected: { sourceSha: string; mode: string },
    readCommitted: (name: string) => string,
) => {
    const root = await realpath(directory)
    const artifactFiles: { path: string; sha256: string }[] = []
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
        else
            artifactFiles.push({
                path: local.split('\\').join('/'),
                sha256: createHash('sha256')
                    .update(await readFile(path))
                    .digest('hex'),
            })
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
    artifactFiles.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
    return {
        output,
        migrationNames: names,
        artifactHash: createHash('sha256').update(JSON.stringify(artifactFiles)).digest('hex'),
    }
}

if (import.meta.main) {
    const reportDiagnostic: NativeReporter = (diagnostic) => {
        const line = JSON.stringify(diagnostic)
        console.info(line)
        if (process.env.GITHUB_STEP_SUMMARY)
            appendFileSync(process.env.GITHUB_STEP_SUMMARY, `Native diagnostic: ${line}\n`)
    }
    try {
        const action = process.argv[2]
        const selected = await nativePhase('source-selection', reportDiagnostic, selection)
        if (action === 'select') {
            if (!process.env.GITHUB_OUTPUT) throw new Error('Actions output destination required.')
            for (const [name, value] of Object.entries({
                mode: selected.mode,
                action: selected.action,
                source_sha: selected.sourceSha,
                trusted_sha: selected.trustedSha,
                trusted_ref: selected.trustedRef,
            }))
                appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`)
        } else {
            const inventory = await nativePhase(
                'protected-approval',
                reportDiagnostic,
                () =>
                    JSON.parse(
                        process.env.AVATIO_CF_RESOURCES_JSON ?? '',
                    ) as CloudflareResourceInventory,
            )
            if (action === 'build') {
                if (selected.action !== 'deploy' || git('rev-parse', 'HEAD') !== selected.sourceSha)
                    throw new Error('Credentialless build source was superseded.')
                await buildCloudflareNative(selected.mode, inventory)
            } else {
                if (
                    git('rev-parse', 'HEAD') !== selected.trustedSha ||
                    git('status', '--porcelain', '--untracked-files=no')
                )
                    throw new Error('Privileged execution requires clean current trusted code.')
                const api = createCloudflareNativeApi(
                    inventory.accountId,
                    process.env.CLOUDFLARE_API_TOKEN ?? '',
                    fetch,
                    undefined,
                    reportDiagnostic,
                )
                const state = {
                    branch: null,
                    commit: selected.trustedSha,
                    dirty: false,
                    ci: { ref: selected.trustedRef, commit: selected.trustedSha },
                }
                if (action === 'approve') {
                    // GitHub protected Environment is the approval boundary, not a custom secret receipt.
                    if (!process.env.CLOUDFLARE_API_TOKEN)
                        throw new Error('Protected Cloudflare credential is unavailable.')
                } else if (action === 'migrate-shared' && selected.action === 'migrate-shared') {
                    const files = readCommittedCloudflareMigrations()
                    const directory = await mkdtemp(join(tmpdir(), 'avatio-shared-migrations-'))
                    for (const file of files) {
                        const path = resolve(directory, 'drizzle', file.name)
                        await mkdir(resolve(path, '..'), { recursive: true })
                        await writeFile(path, file.sql, { mode: 0o600 })
                    }
                    const result = await migrateCloudflareSharedPreview({
                        inventory,
                        api,
                        manualDevelopmentApproved: selected.manualDevelopmentApproved,
                        sourceSha: selected.sourceSha,
                        migrationNames: files.map((file) => file.name).sort(),
                        latestSourceSha: async () => (await selection()).sourceSha,
                        reportDiagnostic,
                        run: (command) =>
                            runCloudflareNativeCommand(command, directory, {
                                PATH: process.env.PATH ?? '',
                                HOME: process.env.HOME ?? '',
                                CI: 'true',
                                CLOUDFLARE_ACCOUNT_ID: inventory.accountId,
                                CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN ?? '',
                                CF_SEND_TELEMETRY: 'false',
                            }),
                    })
                    if (process.env.GITHUB_STEP_SUMMARY)
                        appendFileSync(
                            process.env.GITHUB_STEP_SUMMARY,
                            `Shared PR migrations verified for ${result.sourceSha}; no Preview publication.\n`,
                        )
                } else if (action === 'cleanup' && selected.action === 'cleanup') {
                    await cleanupCloudflareNativePr({
                        inventory,
                        enabled: process.env.AVATIO_NATIVE_DELIVERY_ENABLED === 'true',
                        mode: selected.mode,
                        trustedCode: state,
                        trustedRef: selected.trustedRef,
                        trustedSha: selected.trustedSha,
                        api,
                        readPr: () => githubRead(`/pulls/${selected.mode.slice(3)}`),
                    })
                } else if (action === 'deploy' && selected.action === 'deploy') {
                    const artifact = resolve('.cloudflare/native-incoming')
                    execFileSync('git', ['fetch', '--no-tags', 'origin', selected.sourceSha], {
                        stdio: 'ignore',
                    })
                    const verified = await nativePhase(
                        'artifact-validation',
                        reportDiagnostic,
                        () =>
                            validateCloudflareNativeArtifact(
                                artifact,
                                { sourceSha: selected.sourceSha, mode: selected.mode },
                                (name) =>
                                    execFileSync(
                                        'git',
                                        ['show', `${selected.sourceSha}:drizzle/${name}`],
                                        { encoding: 'utf8' },
                                    ),
                            ),
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
                    const plan = await nativePhase('publish-plan', reportDiagnostic, () =>
                        createCloudflarePublishPlan({
                            inventory,
                            buildOutput: verified.output,
                            migrationNames: verified.migrationNames,
                            evidence: {
                                repository,
                                sourceRepository: repository,
                                eventName: selected.mode.startsWith('pr-')
                                    ? 'workflow_run'
                                    : 'push',
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
                                    isPreview: true,
                                    workerName: 'avatio',
                                },
                            },
                        }),
                    )
                    const sharedMigrationsCompatible = !git(
                        'diff',
                        '--name-only',
                        selected.trustedSha,
                        selected.sourceSha,
                        '--',
                        'drizzle',
                    )
                    await mkdir(resolve('.cloudflare'), { recursive: true })
                    const result = await publishCloudflareNative(plan, {
                        inventory,
                        api,
                        enabled: process.env.AVATIO_NATIVE_DELIVERY_ENABLED === 'true',
                        manualDevelopmentApproved: selected.manualDevelopmentApproved,
                        sharedMigrationsCompatible,
                        reportDiagnostic,
                        latestSourceSha: async () => (await selection()).sourceSha,
                        run: (command) =>
                            runCloudflareNativeCommand(command, artifact, {
                                PATH: process.env.PATH ?? '',
                                HOME: process.env.HOME ?? '',
                                CI: 'true',
                                CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN ?? '',
                                ...plan.commandEnvironment,
                            }),
                        reportPublication: (receipt) => {
                            // Only actual CLI identity plus validated source/artifact hash. Preserve partial evidence.
                            const record = {
                                ...receipt,
                                artifactHash: verified.artifactHash,
                                trustedCodeSha: selected.trustedSha,
                            }
                            writeFileSync(
                                resolve('.cloudflare/native-publication.json'),
                                JSON.stringify(record),
                                { mode: 0o600 },
                            )
                            if (process.env.GITHUB_STEP_SUMMARY)
                                appendFileSync(
                                    process.env.GITHUB_STEP_SUMMARY,
                                    `Published receipt (${receipt.stage}): ${receipt.sourceSha}; Preview ${receipt.previewId}; deployment ${receipt.deploymentId}; ${receipt.deploymentUrl}\n`,
                                )
                        },
                    })
                    if (process.env.GITHUB_STEP_SUMMARY)
                        appendFileSync(
                            process.env.GITHUB_STEP_SUMMARY,
                            `Verified ${result.mode} for ${result.sourceSha}.\nStable URL: ${result.stableUrl}\nSpecific version: ${result.deploymentUrl}\n`,
                        )
                    if (process.env.GITHUB_OUTPUT)
                        appendFileSync(process.env.GITHUB_OUTPUT, `url=${result.stableUrl}\n`)
                } else throw new Error('Unsupported native CI action.')
            }
            console.info(JSON.stringify({ action, mode: selected.mode, completed: true }))
        }
    } catch {
        console.error(
            'Native operation failed closed; retained publication evidence requires inspection. No automatic recovery or resource deletion is performed.',
        )
        process.exitCode = 1
    }
}
