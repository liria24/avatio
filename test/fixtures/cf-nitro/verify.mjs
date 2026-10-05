import assert from 'node:assert/strict'
import { readFile, access } from 'node:fs/promises'
import { join } from 'node:path'

import { readBuildOutput } from '@cloudflare/build-output-utils'

const [mode, preview] = process.argv.slice(2)
const output = await readBuildOutput(process.cwd())
assert.equal(output.rootConfig.buildContext.mode, mode)
assert.equal(output.rootConfig.buildContext.isPreview, preview === 'true')
assert.equal(Object.keys(output.workers).length, 1)
const worker = output.workers.default
assert.equal(worker.config.name, 'avatio')
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
const headers = await readFile(join(worker.assetsDir, '_headers'), 'utf8')
assert.match(headers, /must-revalidate/)
if (preview === 'true') {
    assert.equal(worker.config.env.ITEM_REVALIDATION_QUEUE, undefined)
    assert.equal(worker.config.triggers?.length ?? 0, 0)
    assert.equal(worker.config.env.PREVIEW_NAME.value, mode)
} else {
    assert.ok(worker.config.env.ITEM_REVALIDATION_QUEUE)
    assert.equal(worker.config.triggers.length, 2)
}
console.log(JSON.stringify({ mode, preview, worker: worker.config.name, assetsVerified: true }))
