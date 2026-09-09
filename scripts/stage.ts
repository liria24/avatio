import { execFileSync, spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
    alchemyCommand,
    stageActions,
    validateDeployment,
    type StageAction,
} from '../config/deployment.ts'
import { getStageConfig, parseAvatioStage, type AvatioStage } from '../config/environment.ts'
import { validateSecrets } from '../config/secrets.ts'

const parseAction = (value: string | undefined): StageAction => {
    if (stageActions.includes(value as StageAction)) return value as StageAction
    throw new Error(`Action must be one of: ${stageActions.join(', ')}`)
}

const scriptPath = fileURLToPath(import.meta.url)
const dependencyRoot = join(dirname(scriptPath), '..', 'node_modules')

const run = async (command: string[], env = process.env) => {
    const [executable, ...args] = command
    if (!executable) throw new Error('Missing executable.')
    const exitCode = await new Promise<number>((resolve, reject) => {
        const child = spawn(executable, args, {
            cwd: process.cwd(),
            env,
            stdio: 'inherit',
        })
        child.on('error', reject)
        child.on('exit', (code, signal) => {
            if (signal) reject(new Error(`${executable} exited via ${signal}.`))
            else resolve(code ?? 1)
        })
    })
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

const action = parseAction(process.argv[2])
const stage = parseAvatioStage(process.argv[3] ?? '')
const loaded = process.argv[4] === '--validated-env'

validateBranchPolicy(action, stage)

if (!loaded) {
    const envFile = join(process.cwd(), `.env.${stage}`)
    await run([
        process.execPath,
        join(dependencyRoot, '@dotenvx', 'dotenvx', 'src', 'cli', 'dotenvx.js'),
        'run',
        '--quiet',
        '--strict',
        '-f',
        envFile,
        '--overload',
        '--',
        process.execPath,
        scriptPath,
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
} else {
    await run(alchemyCommand(action, stage))
}
