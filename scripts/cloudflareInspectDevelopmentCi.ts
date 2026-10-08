import { execFileSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'

import type { CloudflareResourceInventory } from '../config/cloudflare.ts'
import { inspectCloudflareDevelopment } from './cloudflareInspectDevelopment.ts'
import { readCommittedCloudflareMigrations } from './cloudflareMigrationHistory.ts'
import { nativePhase, type NativeReporter } from './cloudflareNativeDiagnostics.ts'

const git = (...args: string[]) =>
    execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()

if (import.meta.main) {
    const report: NativeReporter = (diagnostic) => {
        const line = JSON.stringify(diagnostic)
        console.info(line)
        if (process.env.GITHUB_STEP_SUMMARY)
            appendFileSync(process.env.GITHUB_STEP_SUMMARY, `Development inspection: ${line}\n`)
    }
    try {
        const context = await nativePhase('inspection-inputs', report, async () => {
            if (
                process.env.GITHUB_REPOSITORY !== 'liria24/avatio' ||
                process.env.GITHUB_EVENT_NAME !== 'workflow_dispatch' ||
                process.env.GITHUB_REF !== 'refs/heads/development' ||
                process.env.GITHUB_ACTOR !== 'liry24' ||
                process.env.GITHUB_TRIGGERING_ACTOR !== 'liry24'
            )
                throw new Error('Owner/manual/development inspection only.')
            const response = await fetch(
                'https://api.github.com/repos/liria24/avatio/branches/development',
                {
                    redirect: 'error',
                    signal: AbortSignal.timeout(10_000),
                    headers: {
                        accept: 'application/vnd.github+json',
                        authorization: `Bearer ${process.env.GITHUB_TOKEN ?? ''}`,
                    },
                },
            )
            if (!response.ok) throw new Error('Fresh development source read failed.')
            const branch = (await response.json()) as { commit?: { sha?: unknown } }
            const current = branch.commit?.sha
            const trusted = git('rev-parse', 'HEAD')
            if (
                typeof current !== 'string' ||
                current !== process.env.GITHUB_SHA ||
                trusted !== process.env.GITHUB_WORKFLOW_SHA
            )
                throw new Error('Current trusted development workflow code required.')
            return {
                repository: process.env.GITHUB_REPOSITORY,
                eventName: process.env.GITHUB_EVENT_NAME,
                ref: process.env.GITHUB_REF,
                actor: process.env.GITHUB_ACTOR,
                triggeringActor: process.env.GITHUB_TRIGGERING_ACTOR,
                trustedCodeSha: trusted,
                currentDevelopmentSha: current,
                clean: git('status', '--porcelain', '--untracked-files=no') === '',
            }
        })
        const result = await inspectCloudflareDevelopment({
            context,
            historicalSourceSha: process.env.REVIEWED_HISTORICAL_SOURCE_SHA ?? '',
            expectedPreviewId: process.env.REVIEWED_PREVIEW_ID ?? '',
            deploymentId: process.env.REVIEWED_DEPLOYMENT_ID ?? '',
            reviewedImmutableUrl: process.env.REVIEWED_IMMUTABLE_URL || undefined,
            inventory: JSON.parse(
                process.env.AVATIO_CF_RESOURCES_JSON ?? '',
            ) as CloudflareResourceInventory,
            token: process.env.CLOUDFLARE_API_TOKEN ?? '',
            files: readCommittedCloudflareMigrations(),
            reportDiagnostic: report,
        })
        console.info(JSON.stringify(result))
        if (process.env.GITHUB_STEP_SUMMARY)
            appendFileSync(
                process.env.GITHUB_STEP_SUMMARY,
                `Development inspection result: ${JSON.stringify(result)}\nHistorical deployed source provenance remains unverified. No activation or cutover proof.\n`,
            )
    } catch {
        console.error(
            'Development inspection failed closed. No publication, secret transfer, migration or deletion is permitted by this path.',
        )
        process.exitCode = 1
    }
}
