import { join } from 'node:path'

import { getStageConfig, parseAvatioStage, type AvatioStage } from '../config/environment'
import { validateSecrets } from '../config/secrets'

const actions = ['check', 'dev', 'plan', 'deploy'] as const
type StageAction = (typeof actions)[number]

const parseAction = (value: string | undefined): StageAction => {
    if (actions.includes(value as StageAction)) return value as StageAction
    throw new Error(`Action must be one of: ${actions.join(', ')}`)
}

const run = async (command: string[], env = process.env) => {
    const processHandle = Bun.spawn(command, {
        cwd: process.cwd(),
        env,
        stdin: 'inherit',
        stdout: 'inherit',
        stderr: 'inherit',
    })
    const exitCode = await processHandle.exited
    if (exitCode !== 0) process.exit(exitCode)
}

const validateBranchPolicy = (action: StageAction, stage: AvatioStage) => {
    if (action !== 'deploy') return
    const branch = process.env.WORKERS_CI_BRANCH
    if (!branch) return
    const expectedBranch = stage === 'production' ? 'main' : 'development'
    if (branch !== expectedBranch) {
        throw new Error(
            `Refusing ${stage} deploy from branch ${branch}; expected ${expectedBranch}.`,
        )
    }
}

const action = parseAction(Bun.argv[2])
const stage = parseAvatioStage(Bun.argv[3] ?? '')
const loaded = Bun.argv[4] === '--validated-env'

if (!loaded) {
    const envFile = join(process.cwd(), `.env.${stage}`)
    await run([
        'bunx',
        'dotenvx',
        'run',
        '--quiet',
        '-f',
        envFile,
        '--overload',
        '--',
        process.execPath,
        import.meta.path,
        action,
        stage,
        '--validated-env',
    ])
    process.exit(0)
}

getStageConfig(stage)
const secrets = validateSecrets(process.env)
if (!secrets.success) {
    for (const issue of secrets.issues) console.error(`${issue.name}: ${issue.reason}`)
    process.exit(1)
}

validateBranchPolicy(action, stage)

if (action === 'check') {
    console.info(`${stage} configuration is valid.`)
} else if (action === 'dev') {
    if (stage !== 'development') throw new Error('The dev command only supports development.')
    await run(['bunx', 'alchemy', 'dev', '--stage', stage])
} else if (action === 'plan') {
    await run(['bunx', 'alchemy', 'plan', '--stage', stage])
} else {
    await run(['bunx', 'alchemy', 'deploy', '--stage', stage, '--adopt', '--yes'])
}
