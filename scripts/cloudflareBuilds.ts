import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createCloudflareProcessEnvironment } from './cloudflareProcessEnvironment.ts'

/** Bootstrap before importing installed dependencies. No lifecycle/application code runs here. */
export const installCloudflareDependencies = (environment: NodeJS.ProcessEnv) => {
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

/** Defense in depth. Platform branch filters must exclude PR builds before credentials exist. */
export const getCloudflareBuildsContext = (
    environment: NodeJS.ProcessEnv,
    checkout: { sourceSha: string; clean: boolean },
) => {
    const branch = environment.WORKERS_CI_BRANCH
    const stage =
        branch === 'main' ? 'production' : branch === 'development' ? 'development' : undefined
    const sourceSha = environment.WORKERS_CI_COMMIT_SHA ?? ''
    if (
        environment.WORKERS_CI !== '1' ||
        !stage ||
        !/^[a-f0-9]{40}$/.test(sourceSha) ||
        !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(
            environment.WORKERS_CI_BUILD_UUID ?? '',
        ) ||
        checkout.sourceSha !== sourceSha ||
        !checkout.clean
    )
        throw new Error('Exact clean main/development Workers Builds checkout required.')
    return { stage, sourceSha }
}

if (import.meta.main) {
    try {
        const [action, extra] = process.argv.slice(2)
        if (extra || (action !== 'build' && action !== 'deploy'))
            throw new Error('Expected build or deploy.')
        const git = (...args: string[]) =>
            execFileSync('git', args, {
                encoding: 'utf8',
                env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot },
            }).trim()
        const context = getCloudflareBuildsContext(process.env, {
            sourceSha: git('rev-parse', 'HEAD'),
            clean: git('status', '--porcelain', '--untracked-files=no') === '',
        })
        if (action === 'build') {
            if (!['1', 'true'].includes(process.env.SKIP_DEPENDENCY_INSTALL ?? ''))
                throw new Error('Workers Builds automatic lifecycle execution must be disabled.')
            installCloudflareDependencies(process.env)
            const { buildCloudflare } = await import('./cloudflareBuild.ts')
            console.info(
                JSON.stringify(
                    buildCloudflare(
                        context.stage,
                        JSON.parse(process.env.AVATIO_CF_RESOURCES_JSON ?? ''),
                    ),
                ),
            )
        } else {
            const { deployCloudflare } = await import('./cloudflareDeploy.ts')
            await deployCloudflare(context.stage, '.output', context.sourceSha)
        }
    } catch {
        console.error('Workers Builds command stopped; no successful publication is implied.')
        process.exitCode = 1
    }
}
