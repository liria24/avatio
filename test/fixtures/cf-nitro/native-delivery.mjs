import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

import { validateCloudflareBuildOutput } from '../../../config/cloudflareBuildOutput.ts'
import { buildCloudflareNative } from '../../../scripts/cloudflareNativeBuild.ts'
import { validateCloudflareNativeArtifact } from '../../../scripts/cloudflareNativeCi.ts'
import { createCloudflareResourceFixture } from '../../helpers/cloudflareResources.ts'

// Credentialless producer/consumer rehearsal of the actual Nitro build already made by CI.
const mode = process.argv[2]
const root = resolve('../../..')
const inventory = createCloudflareResourceFixture()
const { artifact } = await buildCloudflareNative(mode, inventory, root, true)
const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
const result = await validateCloudflareNativeArtifact(artifact, { sourceSha, mode }, (name) =>
    execFileSync('git', ['show', `${sourceSha}:drizzle/${name}`], { cwd: root, encoding: 'utf8' }),
)
validateCloudflareBuildOutput(result.output, { mode, isPreview: mode !== 'production', inventory })
assert.equal(result.migrationNames.length, 17)
assert.equal(result.output.workers.default.config.name, 'avatio')
console.log(
    JSON.stringify({
        mode,
        sourceSha,
        officialNativeArtifactVerified: true,
        realCloudflareOperations: 0,
    }),
)
