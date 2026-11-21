import { execFileSync, spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createLocalD1Config, getLocalD1Paths } from '../config/localD1.ts'
import { getLocalAuthSecret } from '../config/localDevelopment.ts'
import { createCloudflareProcessEnvironment } from './cloudflareProcessEnvironment.ts'

const wrangler = fileURLToPath(new URL('../bin/wrangler.js', import.meta.resolve('wrangler')))

/** Only local D1 commands run here; normal development never authenticates with Cloudflare. */
export const prepareLocalD1 = (rootDirectory = process.cwd()) => {
    const paths = getLocalD1Paths(rootDirectory)
    const home = join(rootDirectory, '.data', 'tooling-home')
    mkdirSync(home, { recursive: true })
    writeFileSync(paths.configPath, JSON.stringify(createLocalD1Config(rootDirectory)))
    const environment = {
        ...createCloudflareProcessEnvironment(process.env, home),
        CI: 'true',
        WRANGLER_SEND_METRICS: 'false',
        ...(process.env.NODE_OPTIONS ? { NODE_OPTIONS: process.env.NODE_OPTIONS } : {}),
    }
    const run = (args: string[]) =>
        execFileSync(
            process.execPath,
            [
                wrangler,
                'd1',
                ...args,
                '--config',
                paths.configPath,
                '--local',
                '--persist-to',
                paths.persistencePath,
            ],
            { cwd: rootDirectory, env: environment, stdio: 'inherit' },
        )
    run(['migrations', 'apply', 'APP_DB'])
    run([
        'execute',
        'APP_DB',
        '--command',
        `
        CREATE TRIGGER IF NOT EXISTS local_first_user_admin
        AFTER INSERT ON users
        WHEN (SELECT COUNT(*) FROM users) = 1
        BEGIN
            UPDATE users SET role = 'admin' WHERE id = NEW.id;
        END;
    `,
    ])
    getLocalAuthSecret(rootDirectory)
    return paths
}

export const requireLocalDevelopmentPort = () =>
    new Promise<void>((resolve, reject) => {
        const server = createServer()
        server.once('error', () => reject(new Error('Port 3000 is already in use.')))
        server.listen(3000, () => server.close((error) => (error ? reject(error) : resolve())))
    })

if (import.meta.main) {
    await requireLocalDevelopmentPort()
    prepareLocalD1()
    const nuxt = join(
        dirname(fileURLToPath(import.meta.resolve('nuxt/package.json'))),
        'bin',
        'nuxt.mjs',
    )
    const child = spawn(process.execPath, [nuxt, 'dev', ...process.argv.slice(2)], {
        stdio: 'inherit',
        windowsHide: true,
    })
    for (const signal of ['SIGINT', 'SIGTERM'] as const)
        process.once(signal, () => child.kill(signal))
    child.once('error', (error) => {
        throw error
    })
    child.once('exit', (code) => {
        process.exitCode = code ?? 1
    })
}
