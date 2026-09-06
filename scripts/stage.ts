import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

import {
    alchemyCommand,
    stageActions,
    validateDeployment,
    type StageAction,
} from '../config/deployment'
import { getStageConfig, parseAvatioStage, type AvatioStage } from '../config/environment'
import { validateSecrets } from '../config/secrets'

const parseAction = (value: string | undefined): StageAction => {
    if (stageActions.includes(value as StageAction)) return value as StageAction
    throw new Error(`Action must be one of: ${stageActions.join(', ')}`)
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
    if (action !== 'deploy' && action !== 'adopt') return
    const workersBranch = process.env.WORKERS_CI_BRANCH
    if (stage === 'development') {
        if (workersBranch && workersBranch !== 'development')
            throw new Error('Development CI deployment requires the development branch.')
        return
    }
    const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim()
    const branch = git('rev-parse', '--abbrev-ref', 'HEAD')
    const isCI = Boolean(process.env.CI || workersBranch || process.env.GITHUB_ACTIONS)
    validateDeployment(stage, {
        branch: branch === 'HEAD' ? null : branch,
        commit: git('rev-parse', 'HEAD'),
        dirty: Boolean(git('status', '--porcelain', '--untracked-files=normal')),
        ci: isCI
            ? {
                  branch: workersBranch,
                  ref: process.env.GITHUB_REF,
                  commit: process.env.WORKERS_CI_COMMIT_SHA ?? process.env.GITHUB_SHA,
              }
            : undefined,
    })
}

const action = parseAction(Bun.argv[2])
const stage = parseAvatioStage(Bun.argv[3] ?? '')
const loaded = Bun.argv[4] === '--validated-env'

validateBranchPolicy(action, stage)

if (!loaded) {
    const envFile = join(process.cwd(), `.env.${stage}`)
    await run([
        'bunx',
        'dotenvx',
        'run',
        '--quiet',
        '--strict',
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

if (action === 'check') {
    console.info(`${stage} configuration is valid.`)
} else if (action === 'dev') {
    if (stage !== 'development') throw new Error('The dev command only supports development.')
    await run(alchemyCommand(action, stage))
} else {
    await run(alchemyCommand(action, stage))
}
