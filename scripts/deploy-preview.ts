import { resolve } from 'node:path'

const repositoryRoot = resolve(import.meta.dir, '..')

const run = async (arguments_: string[]) => {
    const child = Bun.spawn(arguments_, {
        cwd: repositoryRoot,
        stdin: 'inherit',
        stdout: 'inherit',
        stderr: 'inherit',
    })
    const exitCode = await child.exited
    if (exitCode !== 0) throw new Error(`${arguments_.join(' ')} exited with code ${exitCode}.`)
}

const branch = process.env.WORKERS_CI_BRANCH
if (!branch) throw new Error('WORKERS_CI_BRANCH is required for preview deployment.')

if (branch === 'development') await run([process.execPath, 'run', 'db:migrate:remote'])

await run([
    process.execPath,
    'x',
    'wrangler',
    'versions',
    'upload',
    '--config',
    '.output/server/wrangler.json',
])
