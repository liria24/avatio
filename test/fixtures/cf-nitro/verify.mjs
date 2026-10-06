import assert from 'node:assert/strict'
import { appendFile, readFile, access } from 'node:fs/promises'
import { join } from 'node:path'

import { readBuildOutput } from '@cloudflare/build-output-utils'

import { validateCloudflareBuildOutput } from '../../../config/cloudflareBuildOutput.ts'
import {
    createCloudflarePublishPlan,
    simulateCloudflarePublication,
} from '../../../config/cloudflarePublisher.ts'
import { createCloudflareResourceFixture } from '../../helpers/cloudflareResources.ts'

const [mode, preview] = process.argv.slice(2)
const output = await readBuildOutput(process.cwd())
const inventory = createCloudflareResourceFixture()
validateCloudflareBuildOutput(output, { mode, isPreview: preview === 'true', inventory })
assert.equal(output.rootConfig.buildContext.mode, mode)
assert.equal(output.rootConfig.buildContext.isPreview, preview === 'true')
assert.equal(Object.keys(output.workers).length, 1)
const worker = output.workers.default
assert.equal(worker.config.name, 'avatio')
assert.ok(worker.config.compatibilityFlags.includes('nodejs_compat'))
assert.ok(!worker.config.compatibilityFlags.includes('no_nodejs_compat_v2'))
assert.ok(worker.config.compatibilityFlags.includes('no_handle_cross_request_promise_resolution'))
assert.equal(worker.config.compatibilityDate, '2026-05-26')
for (const binding of [
    'APP_DB',
    'CONTENT_CACHE',
    'R2',
    'SELF_URL',
    'FLAGS',
    'AI',
    'IMAGES',
    'EMAIL',
    'RATE_LIMIT_USER_ACTION',
    'RATE_LIMIT_IMAGE',
    'RATE_LIMIT_DRAFT',
    'RATE_LIMIT_ITEM_RESOLUTION',
    'BETTER_AUTH_SECRET',
    'NUXT_BETTER_AUTH_SECRET',
    'ASSETS',
])
    assert.ok(worker.config.env[binding], `Missing ${binding}`)
assert.equal(worker.config.env.BETTER_AUTH_SECRET.type, 'secret')
assert.equal(worker.config.env.NUXT_BETTER_AUTH_SECRET.type, 'secret')
assert.equal(worker.config.env.APP_DB.id.startsWith('00000000-'), true)
assert.ok(worker.bundleDir)
assert.ok(worker.assetsDir)
await access(join(worker.assetsDir, 'sw.js'))
await access(join(worker.assetsDir, 'manifest.webmanifest'))
for (const name of Object.keys(worker.config.manifest.modules))
    await access(join(worker.bundleDir, name))
assert.match(await readFile(join(worker.assetsDir, '_headers'), 'utf8'), /must-revalidate/)
if (preview === 'true') {
    assert.equal(worker.config.env.ITEM_REVALIDATION_QUEUE, undefined)
    assert.equal(worker.config.triggers?.length ?? 0, 0)
    assert.equal(worker.config.env.PREVIEW_NAME.value, mode)
} else {
    assert.ok(worker.config.env.ITEM_REVALIDATION_QUEUE)
    assert.equal(worker.config.triggers.length, 2)
}
// Simulated receipts only: no process runner, token, secret transfer or Cloudflare API call.
const sourceSha = 'a'.repeat(40)
const migrationNames = ['20260801000000_synthetic/migration.sql']
const plan = createCloudflarePublishPlan({
    inventory,
    buildOutput: output,
    migrationNames,
    evidence: {
        repository: 'liria24/avatio',
        sourceRepository: 'liria24/avatio',
        eventName: preview === 'true' ? 'workflow_run' : 'push',
        ref: preview === 'true' ? `refs/pull/${mode.slice(3)}/head` : 'refs/heads/main',
        mode,
        sourceSha,
        latestSourceSha: sourceSha,
        trustedCodeSha: sourceSha,
        checkedOutCodeSha: sourceSha,
        trustedCodeRef: 'refs/heads/main',
        buildSucceeded: true,
        build: { sourceSha, mode, isPreview: preview === 'true', workerName: 'avatio' },
        state: {
            branch: null,
            commit: sourceSha,
            dirty: false,
            ci: { ref: 'refs/heads/main', commit: sourceSha },
        },
    },
})
const target = preview === 'true' ? inventory.previews[mode] : inventory.production
const calls = []
const simulation = await simulateCloudflarePublication(plan, {
    simulation: true,
    inspectedResources: async () => ({
        complete: true,
        accountId: inventory.accountId,
        workerName: 'avatio',
        resources: {
            database: target.database,
            cache: target.cache,
            bucket: { name: target.bucket },
        },
    }),
    run: async (command) => {
        calls.push(command.args)
        if (command.args[3] === 'apply')
            return { exitCode: 0, output: migrationNames.map((name) => ({ name, status: '✅' })) }
        if (command.args[3] === 'list') return { exitCode: 0, output: [] }
        return {
            exitCode: 0,
            output:
                preview === 'true'
                    ? {
                          type: 'preview',
                          version: 1,
                          preview_id: 'synthetic-preview',
                          preview_name: mode,
                          preview_slug: mode,
                          preview_urls: [target.siteUrl],
                          deployment_id: 'synthetic-version',
                          deployment_urls: [
                              `https://synthetic-version-${mode}.previews.example.test`,
                          ],
                      }
                    : { syntheticVersion: true },
        }
    },
    appliedNames: async () => migrationNames,
    latestSourceSha: async () => sourceSha,
    verifyVersion: async () => true,
})
assert.equal(calls.length, 3)
assert.equal(simulation.activationVerified, false)
assert.equal(simulation.cloudflareOperations, 0)
console.log(
    JSON.stringify({
        mode,
        preview,
        nodeCompat: 'v2',
        buildOutputVerified: true,
        completeBindingContractVerified: true,
        publisherSimulationVerified: simulation.simulationComplete,
        deploymentVerified: false,
    }),
)
if (process.env.GITHUB_STEP_SUMMARY)
    await appendFile(
        process.env.GITHUB_STEP_SUMMARY,
        `v2 packaging and static Build Output verified for ${mode}. Runtime behavior, secret scoping, populated migrations, Preview lifecycle and deployments remain unverified.\n`,
    )
