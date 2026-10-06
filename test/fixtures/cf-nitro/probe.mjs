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
    'cf now accepts historical v1: review whether this diagnostic is still necessary',
)
const output = `${failure.stdout}\n${failure.stderr}`
assert.notEqual(failure.status, 0)
assert.match(output, /Unsupported Node\.js compat mode \(v1\)\. Only the v2 mode is supported/)
process.stdout.write(output)
const result = {
    mode,
    historicalV1Unsupported: true,
    reason: 'The official Vite plugin rejects the historical no_nodejs_compat_v2 flag.',
    buildOutputVerified: false,
    deploymentVerified: false,
}
console.log(JSON.stringify(result))
if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        `Historical v1 remains unsupported for ${mode}. This diagnostic reproduces that refusal; the v2 rows verify actual Build Output and runtime separately. Remote secrets, populated migrations and Preview lifecycle remain activation gates.\n`,
    )
