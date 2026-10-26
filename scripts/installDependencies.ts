import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createCloudflareProcessEnvironment } from './cloudflareProcessEnvironment.ts'

/** Bootstrap before importing installed dependencies. No lifecycle/application code runs here. */
export const installDependencies = (environment: NodeJS.ProcessEnv) => {
    const home = mkdtempSync(join(tmpdir(), 'avatio-cloudflare-install-'))
    try {
        execFileSync(
            process.platform === 'win32' ? 'bun.exe' : 'bun',
            [
                'install',
                '--frozen-lockfile',
                '--ignore-scripts',
                '--no-env-file',
                '--registry',
                'https://registry.npmjs.org',
            ],
            {
                env: createCloudflareProcessEnvironment(environment, home),
                stdio: 'inherit',
            },
        )
    } finally {
        rmSync(home, { recursive: true, force: true })
    }
}

if (import.meta.main) installDependencies(process.env)
