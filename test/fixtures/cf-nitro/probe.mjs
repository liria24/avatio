import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'

const mode = process.argv[2]
assert.ok(mode === 'production' || mode === 'pr-354')
const args = ['node_modules/cf/bin/cf', 'build', '--mode', mode]
let failure
try {
    execFileSync(process.execPath, args, { encoding: 'utf8', stdio: 'pipe' })
} catch (error) {
    failure = error
}
assert.ok(
    failure,
    'cf now accepts the preserved flags: replace this blocker probe with full activation verification',
)
const output = `${failure.stdout}\n${failure.stderr}`
assert.notEqual(failure.status, 0)
assert.match(output, /Unsupported Node\.js compat mode \(v1\)\. Only the v2 mode is supported/)
process.stdout.write(output)
const result = {
    mode,
    blocked: true,
    reason: 'The official Vite plugin rejects the preserved no_nodejs_compat_v2 flag.',
    buildOutputVerified: false,
    deploymentVerified: false,
}
console.log(JSON.stringify(result))
if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        `Native Preview activation is **BLOCKED** for ${mode}. This check verifies the upstream refusal; it does not verify deployable Build Output, runtime behavior, secrets, migrations, or lifecycle.\n`,
    )
