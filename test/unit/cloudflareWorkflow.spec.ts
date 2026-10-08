import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const workflow = (name: string) =>
    readFileSync(new URL(`../../.github/workflows/${name}.yml`, import.meta.url), 'utf8')
const delivery = workflow('native-delivery')
const sourceSha = 'a'.repeat(40)
const requiredChecks = ['format', 'lint', 'lint:unused', 'typecheck', 'test', 'build']

// Exercise the actual workflow heredoc, rather than maintaining another source selector.
const literal = delivery.match(/^ {10}node --input-type=module <<'JS'\n([\s\S]*?)^ {10}JS$/m)?.[1]
if (!literal) throw new Error('The maintained delivery source guard is missing.')
const guard = literal.replace(/^ {10}/gm, '')

interface GuardFixture {
    env: Record<string, string>
    event: { workflow_run: { id: number; head_sha: string } }
    workflow: { id: number }
    run: {
        workflow_id: number
        path: string
        repository: { full_name: string }
        head_repository: { full_name: string }
        event: string
        head_branch: string
        status: string
        conclusion: string
        head_sha: string
    }
    current: { object: { sha: string } }
    jobs: { total_count: number; jobs: { name: string; conclusion: string }[] }
    available: boolean
}

interface GuardCase {
    name: string
    target?: string
    manual?: boolean
    allowed?: boolean
    mutate?: (fixture: GuardFixture) => void
}

const cases: GuardCase[] = [
    { name: 'current successful development push', allowed: true },
    { name: 'current successful production push', target: 'production', allowed: true },
    { name: 'owner manual development with exact push quality', manual: true, allowed: true },
    {
        name: 'owner manual production with exact push quality',
        target: 'production',
        manual: true,
        allowed: true,
    },
    { name: 'PR target', target: 'pr-354' },
    {
        name: 'PR workflow event',
        mutate: (f) => {
            f.env.GITHUB_EVENT_NAME = 'pull_request'
        },
    },
    {
        name: 'PR quality run',
        mutate: (f) => {
            f.run.event = 'pull_request'
        },
    },
    {
        name: 'fork quality run',
        mutate: (f) => {
            f.run.head_repository.full_name = 'fork/avatio'
        },
    },
    {
        name: 'foreign repository',
        mutate: (f) => {
            f.env.GITHUB_REPOSITORY = 'fork/avatio'
        },
    },
    {
        name: 'production run from development',
        target: 'production',
        mutate: (f) => {
            f.run.head_branch = 'development'
        },
    },
    {
        name: 'stale branch source',
        mutate: (f) => {
            f.current.object.sha = 'b'.repeat(40)
        },
    },
    {
        name: 'wrong run source',
        mutate: (f) => {
            f.run.head_sha = 'b'.repeat(40)
        },
    },
    {
        name: 'wrong workflow event source',
        mutate: (f) => {
            f.event.workflow_run.head_sha = 'b'.repeat(40)
        },
    },
    {
        name: 'different workflow ID',
        mutate: (f) => {
            f.run.workflow_id++
        },
    },
    {
        name: 'different quality workflow path',
        mutate: (f) => {
            f.run.path = '.github/workflows/other.yml'
        },
    },
    {
        name: 'failed quality run',
        mutate: (f) => {
            f.run.conclusion = 'failure'
        },
    },
    {
        name: 'quality rerun in progress',
        mutate: (f) => {
            f.run.status = 'in_progress'
        },
    },
    {
        name: 'skipped required build',
        mutate: (f) => {
            f.jobs.jobs[5]!.conclusion = 'skipped'
        },
    },
    {
        name: 'cancelled required test',
        mutate: (f) => {
            f.jobs.jobs[4]!.conclusion = 'cancelled'
        },
    },
    {
        name: 'missing required lint',
        mutate: (f) => {
            f.jobs.jobs.splice(1, 1)
            f.jobs.total_count--
        },
    },
    {
        name: 'duplicate required build',
        mutate: (f) => {
            f.jobs.jobs.push({ name: 'build', conclusion: 'success' })
            f.jobs.total_count++
        },
    },
    {
        name: 'incomplete paginated quality evidence',
        mutate: (f) => {
            f.jobs.total_count = 101
        },
    },
    {
        name: 'unavailable GitHub evidence',
        mutate: (f) => {
            f.available = false
        },
    },
    {
        name: 'unsafe quality run number',
        mutate: (f) => {
            f.env.QUALITY_RUN_ID = '99999999999999999999'
        },
    },
    {
        name: 'non-owner manual request',
        manual: true,
        mutate: (f) => {
            f.env.GITHUB_ACTOR = 'other'
        },
    },
    {
        name: 'wrong manual source branch',
        manual: true,
        mutate: (f) => {
            f.env.GITHUB_REF = 'refs/heads/feature'
        },
    },
    {
        name: 'stale manual dispatch source',
        manual: true,
        mutate: (f) => {
            f.env.GITHUB_SHA = 'b'.repeat(40)
        },
    },
]

describe('maintained Cloudflare delivery workflows', () => {
    it.each(cases)(
        'runs the actual guard for $name',
        ({ target = 'development', manual, allowed, mutate }) => {
            const directory = mkdtempSync(join(tmpdir(), 'avatio-workflow-'))
            const branch = target === 'production' ? 'main' : 'development'
            const fixture: GuardFixture = {
                env: {
                    DELIVERY_TARGET: target,
                    EXPECTED_SOURCE_SHA: sourceSha,
                    QUALITY_RUN_ID: '123',
                    GITHUB_TOKEN: 'synthetic-workflow-token',
                    GITHUB_REPOSITORY: 'liria24/avatio',
                    GITHUB_EVENT_NAME: manual ? 'workflow_dispatch' : 'workflow_run',
                    GITHUB_REF: `refs/heads/${branch}`,
                    GITHUB_SHA: sourceSha,
                    GITHUB_ACTOR: 'liry24',
                    GITHUB_TRIGGERING_ACTOR: 'liry24',
                    GITHUB_EVENT_PATH: join(directory, 'event.json'),
                    GITHUB_OUTPUT: join(directory, 'output'),
                },
                event: { workflow_run: { id: 123, head_sha: sourceSha } },
                workflow: { id: 42 },
                run: {
                    workflow_id: 42,
                    path: '.github/workflows/quality.yml',
                    repository: { full_name: 'liria24/avatio' },
                    head_repository: { full_name: 'liria24/avatio' },
                    event: 'push',
                    head_branch: branch,
                    status: 'completed',
                    conclusion: 'success',
                    head_sha: sourceSha,
                },
                current: { object: { sha: sourceSha } },
                jobs: {
                    total_count: requiredChecks.length,
                    jobs: requiredChecks.map((name) => ({ name, conclusion: 'success' })),
                },
                available: true,
            }
            mutate?.(fixture)
            const mock = `
            const fixture = ${JSON.stringify(fixture)}
            const endpoints = new Map([
                ['/repos/liria24/avatio/actions/workflows/quality.yml', fixture.workflow],
                ['/repos/liria24/avatio/actions/runs/123', fixture.run],
                ['/repos/liria24/avatio/git/ref/heads/${branch}', fixture.current],
                ['/repos/liria24/avatio/actions/runs/123/jobs?per_page=100', fixture.jobs],
            ])
            globalThis.fetch = async (url, options) => {
                const parsed = new URL(url)
                assert.equal(parsed.origin, 'https://api.github.com')
                assert.equal(options.redirect, 'error')
                assert.equal(options.headers.authorization, 'Bearer synthetic-workflow-token')
                assert.ok(options.signal instanceof AbortSignal)
                const path = parsed.pathname + parsed.search
                assert.ok(endpoints.has(path), 'No unmocked network request is permitted')
                return { ok: fixture.available, json: async () => endpoints.get(path) }
            }
        `
            try {
                writeFileSync(fixture.env.GITHUB_EVENT_PATH!, JSON.stringify(fixture.event))
                writeFileSync(fixture.env.GITHUB_OUTPUT!, '')
                const result = spawnSync(
                    process.execPath,
                    ['--input-type=module', '-e', `${mock}\n${guard}`],
                    {
                        // No inherited home, deployment credentials, signing values, dotenv keys or network code.
                        env: { PATH: process.env.PATH ?? '', CI: 'true', ...fixture.env },
                        encoding: 'utf8',
                        timeout: 5_000,
                        maxBuffer: 1024 * 1024,
                    },
                )
                expect(result.error).toBeUndefined()
                if (allowed) {
                    expect(result.stderr).toBe('')
                    expect(result.status).toBe(0)
                    expect(readFileSync(fixture.env.GITHUB_OUTPUT!, 'utf8')).toBe(
                        `source_sha=${sourceSha}\n`,
                    )
                } else {
                    expect(result.status).toBe(1)
                    expect(readFileSync(fixture.env.GITHUB_OUTPUT!, 'utf8')).toBe('')
                }
            } finally {
                rmSync(directory, { recursive: true, force: true })
            }
        },
    )

    it('isolates credentialless build execution from protected trusted publication', () => {
        const build = delivery.split('\n  build:\n')[1]?.split('\n  publish:\n')[0]
        const publish = delivery.split('\n  publish:\n')[1]
        expect(build).toBeDefined()
        expect(publish).toBeDefined()
        expect(build).not.toMatch(/secrets\.|CLOUDFLARE_API_TOKEN|DOTENV_PRIVATE_KEY/)
        expect(build).toContain('AVATIO_CF_RESOURCES_JSON: ${{ vars.AVATIO_CF_RESOURCES_JSON }}')
        expect(build).toContain('ref: ${{ needs.select.outputs.source_sha }}')
        expect(build).toContain('persist-credentials: false')
        expect(build).toContain('AVATIO_SOURCE_SHA: ${{ needs.select.outputs.source_sha }}')
        expect(delivery.match(/environment: \$\{\{ inputs.target \}\}/g)).toHaveLength(2)
        expect(publish).toContain('ref: ${{ github.workflow_sha }}')
        expect(publish).toContain('persist-credentials: false')
        expect(publish).toContain('artifact-ids: ${{ needs.build.outputs.artifact_id }}')
        expect(publish).toContain('EXPECTED_SOURCE_SHA: ${{ needs.select.outputs.source_sha }}')
        expect(publish).toContain(
            'EXPECTED_ARTIFACT_SHA256: ${{ needs.build.outputs.artifact_sha256 }}',
        )
        expect(publish).toContain(
            'AVATIO_MIGRATION_HISTORY_VERIFIED: ${{ vars.AVATIO_MIGRATION_HISTORY_VERIFIED }}',
        )
        expect(publish).toContain('node scripts/cloudflareDeploy.ts "$DELIVERY_TARGET" .output')
        expect(publish).toContain('path: .cloudflare/delivery/published.json')
        expect(delivery).toContain('- &verify-source')
        expect(publish).toContain('- *verify-source')
        expect(publish!.indexOf('- *verify-source')).toBeLessThan(
            publish!.indexOf('node scripts/cloudflareDeploy.ts'),
        )
        expect(delivery).toContain(
            'group: avatio-native-${{ inputs.target }}\n  cancel-in-progress: false',
        )
        expect(delivery).not.toContain('secrets: inherit')
    })

    it.each([
        ['production', 'main'],
        ['development', 'development'],
    ])('keeps the %s caller branch-only and inactive pending acceptance', (target, branch) => {
        const text = workflow(`native-${target}`)
        expect(text).toContain(`branches: [${branch}]`)
        expect(text).toContain(`target: ${target}`)
        expect(text).toContain(`github.ref == 'refs/heads/${branch}'`)
        expect(text).toContain("github.event.workflow_run.event == 'push'")
        expect(text).toContain("github.event.workflow_run.conclusion == 'success'")
        expect(text).toContain(
            'github.event.workflow_run.head_repository.full_name == github.repository',
        )
        expect(text).toContain("vars.AVATIO_NATIVE_DELIVERY_ENABLED == 'true'")
        expect(text).toContain("github.actor == 'liry24' && github.triggering_actor == 'liry24'")
        expect(text).toContain('CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}')
        expect(text).not.toMatch(/^ {2}(?:pull_request|pull_request_target|push):/m)
        expect(text).not.toContain('secrets: inherit')
        if (target === 'production')
            expect(text).toContain("vars.AVATIO_PRODUCTION_DELIVERY_ENABLED == 'true'")
        expect(delivery).toContain("vars.AVATIO_NATIVE_DELIVERY_ENABLED == 'true'")
        expect(delivery).toContain(
            "inputs.target != 'production' || vars.AVATIO_PRODUCTION_DELIVERY_ENABLED == 'true'",
        )
    })

    it('keeps every PR secretless with unchanged required checks and full applicable test aggregation', () => {
        const quality = workflow('quality')
        expect(quality).toContain('  pull_request:\n  push:')
        expect(quality).not.toMatch(
            /secrets\.|environment:|preview_delivery|shared_preview_migrations|uses: \.\/\.github\/workflows/,
        )
        expect(quality).toContain("check: [format, lint, 'lint:unused', typecheck, build]")
        expect(quality).toContain('    name: test\n')
        expect(quality).toContain('suite: [unit, integration, nuxt, http, bindings]')
        expect(quality).toContain(
            'needs: [test-suites, cloudflare-application, browser-smoke, browser-extended]',
        )
        expect(quality).toContain('target: [production, development]')
        expect(quality).toContain('node test/cloudflare/application.mjs "${{ matrix.target }}"')
        expect(quality).toContain('node test/cloudflare/migrations.mjs')
        for (const project of ['chromium-extended', 'firefox', 'webkit', 'mobile'])
            expect(quality).toContain(`project: ${project}`)
        const inspection = workflow('native-inspection')
        expect(inspection).toContain(
            'group: avatio-native-development\n  cancel-in-progress: false',
        )
        expect(inspection).toContain('  workflow_dispatch:')
        expect(inspection).not.toMatch(
            /^ {2}(?:workflow_call|pull_request|pull_request_target|push):/m,
        )
    })
})
