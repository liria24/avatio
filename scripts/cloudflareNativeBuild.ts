import { execFileSync } from 'node:child_process'
import { mkdir, writeFile, access, cp } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { readBuildOutput } from '@cloudflare/build-output-utils'

import { createCloudflareConfig } from '../config/cloudflare.ts'
import { validateCloudflareBuildOutput } from '../config/cloudflareBuildOutput.ts'
import { readCommittedCloudflareMigrations } from './cloudflareMigrationHistory.ts'

/** A Nuxt/Nitro build followed by the pinned official Vite packager, without a custom output writer.
 * Packaging tools remain isolated in the existing compatibility fixture until activation is proven.
 * This function is for credentialless CI only: never run PR application code with a deploy token.
 */
export const buildCloudflareNative = async (
    mode: string,
    inventory: unknown,
    root = process.cwd(),
    existingNitroOutput = false,
) => {
    if (
        process.env.CLOUDFLARE_API_TOKEN ||
        process.env.DOTENV_PRIVATE_KEY_PRODUCTION ||
        process.env.DOTENV_PRIVATE_KEY_DEVELOPMENT ||
        process.env.BETTER_AUTH_SECRET
    )
        throw new Error(
            'Native application build must not receive deployment or signing credentials.',
        )
    const configuration = createCloudflareConfig(
        { mode, isPreview: mode !== 'production' },
        inventory,
    )
    const env = configuration.worker.env
    const text = (name: string) => {
        const value = env[name]
        return value?.type === 'text' ? value.value : ''
    }
    const directory = await mkdir(resolve(root, '.cloudflare', 'native-build'), {
        recursive: true,
    }).then(() => resolve(root, '.cloudflare', 'native-build'))
    const inventoryFile = resolve(directory, 'resources.json')
    await writeFile(inventoryFile, JSON.stringify(inventory), { mode: 0o600 })
    const buildEnv = {
        ...process.env,
        STAGE: mode === 'production' ? 'production' : 'development',
        PREVIEW_NAME: mode === 'production' ? '' : mode,
        PUBLIC_SITE_URL: text('PUBLIC_SITE_URL'),
        R2_PUBLIC_BASE_URL: text('R2_PUBLIC_BASE_URL'),
        AVATIO_CF_RESOURCES_FILE: inventoryFile,
        NITRO_PRESET: 'cloudflare_module',
        NODE_OPTIONS: '--max-old-space-size=4096',
        CLOUDFLARE_PREVIEW_BUILD: String(mode !== 'production'),
    }
    if (!existingNitroOutput)
        execFileSync(process.platform === 'win32' ? 'vp.cmd' : 'vp', ['run', 'build'], {
            cwd: root,
            env: buildEnv,
            stdio: 'inherit',
            windowsHide: true,
        })
    const url = (path: string) => JSON.stringify(pathToFileURL(resolve(root, path)).href)
    await writeFile(
        resolve(directory, 'package.json'),
        JSON.stringify({ private: true, type: 'module' }),
    )
    await writeFile(
        resolve(directory, 'cloudflare.config.ts'),
        `import original from ${url('cloudflare.config.ts')}; import {defineConfig} from 'cf/config'; export default defineConfig(async(context)=>{const config = await original(context); return {...config, worker:{...config.worker, entrypoint:${JSON.stringify(resolve(root, '.output/server/index.mjs'))}}}});`,
    )
    await writeFile(
        resolve(directory, 'vite.config.mjs'),
        `import {cloudflare} from ${url('test/fixtures/cf-nitro/node_modules/@cloudflare/vite-plugin/dist/index.mjs')}; export default {publicDir:${JSON.stringify(resolve(root, '.output/public'))}, plugins:[cloudflare({remoteBindings:false,types:{generate:false}})]};`,
    )
    // The official Vite API performs packaging. cf's Nuxt/workspace autodetection is not used.
    const tools = pathToFileURL(
        resolve(root, 'test/fixtures/cf-nitro/node_modules/vite/dist/node/index.js'),
    ).href
    Object.assign(process.env, buildEnv)
    const { createBuilder } = (await import(tools)) as {
        createBuilder: (input: unknown) => Promise<{ buildApp: () => Promise<void> }>
    }
    // https://vite.dev/guide/api-environment-frameworks#building-programmatically-with-createbuilder
    const builder = await createBuilder({
        root: directory,
        mode,
        configFile: resolve(directory, 'vite.config.mjs'),
    })
    await builder.buildApp()
    const output = await readBuildOutput(directory)
    validateCloudflareBuildOutput(output, { mode, isPreview: mode !== 'production', inventory })
    for (const [name, worker] of Object.entries(output.workers)) {
        if (name !== 'default' || !worker.bundleDir || !worker.assetsDir)
            throw new Error('Complete single-Worker output required.')
        for (const name of Object.keys(worker.config.manifest?.modules ?? {}))
            await access(resolve(worker.bundleDir, name))
        for (const name of ['sw.js', 'manifest.webmanifest'])
            await access(resolve(worker.assetsDir, name))
    }
    const migrations = readCommittedCloudflareMigrations(root)
    const artifact = resolve(root, '.cloudflare', 'native-artifact')
    await mkdir(artifact, { recursive: true })
    await cp(resolve(directory, '.cloudflare'), resolve(artifact, '.cloudflare'), {
        recursive: true,
        errorOnExist: true,
        force: false,
    })
    for (const migration of migrations) {
        const path = resolve(artifact, 'drizzle', migration.name)
        await mkdir(resolve(path, '..'), { recursive: true })
        await writeFile(path, migration.sql)
    }
    await writeFile(
        resolve(artifact, 'receipt.json'),
        JSON.stringify({
            version: 1,
            sourceSha: execFileSync('git', ['rev-parse', 'HEAD'], {
                cwd: root,
                encoding: 'utf8',
            }).trim(),
            mode,
            isPreview: mode !== 'production',
            workerName: 'avatio',
            migrations: migrations.map(({ name, hash }) => ({ name, hash })),
        }),
    )
    return { artifact, mode, buildVerified: true as const }
}
