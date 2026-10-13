import { execFileSync } from 'node:child_process'

import { installCloudflareDependencies } from './cloudflareBuilds.ts'
import { getCloudflareDevelopmentContext } from './cloudflareDeliveryContext.ts'

if (import.meta.main) {
    try {
        const [action, extra] = process.argv.slice(2)
        if (extra || !['check', 'build', 'deploy'].includes(action ?? ''))
            throw new Error('Expected check, build or deploy.')
        const git = (...args: string[]) =>
            execFileSync('git', args, {
                encoding: 'utf8',
                env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot },
            }).trim()
        const context = getCloudflareDevelopmentContext(process.env, {
            sourceSha: git('rev-parse', 'HEAD'),
            clean: git('status', '--porcelain', '--untracked-files=no') === '',
        })
        if (action === 'build') {
            installCloudflareDependencies(process.env)
            const { buildCloudflare } = await import('./cloudflareBuild.ts')
            console.info(
                JSON.stringify(
                    buildCloudflare(
                        context.stage,
                        JSON.parse(process.env.AVATIO_CF_RESOURCES_JSON ?? ''),
                        process.cwd(),
                        { ...process.env, AVATIO_SOURCE_SHA: context.sourceSha },
                    ),
                ),
            )
        } else if (action === 'deploy') {
            const { deployCloudflare } = await import('./cloudflareDeploy.ts')
            await deployCloudflare(context.stage, '.output', context.sourceSha)
        } else console.info(JSON.stringify(context))
    } catch {
        console.error('Development command stopped; no successful publication is implied.')
        process.exitCode = 1
    }
}
