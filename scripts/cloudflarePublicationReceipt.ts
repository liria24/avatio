import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { getVoidConfig } from '../config/void.ts'

const record = (value: unknown): Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {}
const uuid = (value: unknown): value is string =>
    typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value)

/** Metadata only: save actual IDs before later version inspection can fail. */
export const recordCloudflarePublication = (
    stage: string,
    sourceSha: string,
    root = process.cwd(),
    query: (args: string[]) => unknown = (args) =>
        JSON.parse(
            execFileSync(
                process.execPath,
                [resolve(root, 'node_modules/wrangler/bin/wrangler.js'), ...args],
                {
                    cwd: root,
                    encoding: 'utf8',
                    stdio: ['ignore', 'pipe', 'pipe'],
                    timeout: 30_000,
                    maxBuffer: 4 * 1024 * 1024,
                },
            ),
        ),
) => {
    if (!/^[a-f0-9]{40}$/.test(sourceSha)) throw new Error('An exact source SHA is required.')
    const config = getVoidConfig(stage).cloudflare
    const directory = resolve(root, '.cloudflare/delivery')
    mkdirSync(directory, { recursive: true })
    const receipt: {
        stage: string
        worker: string
        expectedSourceSha: string
        candidateVersionIds: string[]
        deploymentId?: string
        versions?: { versionId: string; percentage: number; sourceSha?: string }[]
        exactSourceVerified: boolean
    } = {
        stage,
        worker: config.name,
        expectedSourceSha: sourceSha,
        candidateVersionIds: [],
        exactSourceVerified: false,
    }
    const save = () =>
        writeFileSync(resolve(directory, 'published.json'), `${JSON.stringify(receipt, null, 2)}\n`)
    const candidatePath = resolve(root, '.void/cloudflare-candidate.json')
    if (existsSync(candidatePath)) {
        const candidate = record(JSON.parse(readFileSync(candidatePath, 'utf8')))
        if (
            candidate.accountId === config.account_id &&
            candidate.workerName === config.name &&
            Array.isArray(candidate.versionIds)
        )
            receipt.candidateVersionIds = candidate.versionIds.filter(uuid)
    }
    save()
    try {
        const deployment = record(query(['deployments', 'status', '--name', config.name, '--json']))
        if (
            !uuid(deployment.id) ||
            !Array.isArray(deployment.versions) ||
            !deployment.versions.length
        )
            throw new Error('Invalid deployment metadata.')
        receipt.deploymentId = deployment.id
        receipt.versions = deployment.versions.map((value) => {
            const version = record(value)
            if (!uuid(version.version_id) || typeof version.percentage !== 'number')
                throw new Error('Invalid version metadata.')
            return { versionId: version.version_id, percentage: version.percentage }
        })
        save()
        for (const version of receipt.versions) {
            const metadata = record(
                query(['versions', 'view', version.versionId, '--name', config.name, '--json']),
            )
            const bindings = record(metadata.resources).bindings
            if (!Array.isArray(bindings)) throw new Error('Version bindings are unavailable.')
            const binding = bindings
                .map(record)
                .find(
                    (binding) =>
                        binding.name === 'AVATIO_SOURCE_SHA' && binding.type === 'plain_text',
                )
            if (typeof binding?.text === 'string' && /^[a-f0-9]{40}$/.test(binding.text))
                version.sourceSha = binding.text
            save()
        }
        receipt.exactSourceVerified =
            receipt.versions.length === 1 &&
            receipt.versions[0]?.percentage === 100 &&
            receipt.versions[0]?.sourceSha === sourceSha
        save()
        if (!receipt.exactSourceVerified) throw new Error('Published source does not match.')
        return receipt
    } catch {
        throw new Error(
            'Publication verification failed; observed IDs are retained in the receipt.',
        )
    }
}

if (import.meta.main) {
    const [stage, extra] = process.argv.slice(2)
    if (!stage || extra) throw new Error('One explicit stage is required.')
    console.info(
        JSON.stringify(recordCloudflarePublication(stage, process.env.AVATIO_SOURCE_SHA ?? '')),
    )
}
