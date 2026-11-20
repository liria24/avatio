import { execFileSync } from 'node:child_process'
import {
    existsSync,
    lstatSync,
    mkdirSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join, relative, resolve } from 'node:path'

import { getCloudflareConfig } from '../config/cloudflare.ts'
import { parseAvatioStage } from '../config/environment.ts'
import { secretDefinitions } from '../config/secrets.ts'
import { createCloudflareProcessEnvironment } from './cloudflareProcessEnvironment.ts'

const applicationSecretNames = new Set([
    'BETTER_AUTH_SECRET',
    ...secretDefinitions.map(({ key }) => key),
])

const requireCredentiallessApplicationEnvironment = (environment: NodeJS.ProcessEnv) => {
    if (
        Object.entries(environment).some(
            ([name, value]) =>
                value &&
                (applicationSecretNames.has(name.toUpperCase()) ||
                    /^DOTENV_PRIVATE_KEY(?:_|$)/i.test(name) ||
                    /^(?:NUXT_|AVATIO_).*(?:SECRET|TOKEN|PASSWORD|PRIVATE_KEY)(?:_|$)/i.test(name)),
        )
    )
        throw new Error(
            'Application builds must not receive plaintext application secrets or dotenv private keys.',
        )
}

const assertCleanOutput = (root: string) => {
    for (const entry of readdirSync(root, { recursive: true, withFileTypes: true })) {
        const file = resolve(entry.parentPath, entry.name)
        const metadata = lstatSync(file)
        if (metadata.isSymbolicLink()) throw new Error('Artifact symlinks are not permitted.')
        if (metadata.isDirectory()) continue
        if (!metadata.isFile()) throw new Error('Artifact contains an unsupported file.')
        const name = relative(root, file).replaceAll('\\', '/')
        if (name.split('/').some((part) => part.startsWith('.env')))
            throw new Error('Environment files are not permitted in application artifacts.')
    }
}

/** The publisher may retain its platform token; no credential is inherited by build children. */
export const createCloudflareBuildEnvironment = (
    mode: string,
    environment: NodeJS.ProcessEnv,
    home: string,
): NodeJS.ProcessEnv => {
    requireCredentiallessApplicationEnvironment(environment)
    const stage = parseAvatioStage(mode)
    const configuration = getCloudflareConfig(stage)
    return {
        ...createCloudflareProcessEnvironment(environment, home),
        STAGE: stage,
        PUBLIC_SITE_URL: String(configuration.vars.PUBLIC_SITE_URL),
        R2_PUBLIC_BASE_URL: String(configuration.vars.R2_PUBLIC_BASE_URL),
        NITRO_PRESET: 'cloudflare_module',
        NODE_OPTIONS: '--max-old-space-size=4096',
        WRANGLER_SEND_METRICS: 'false',
    }
}

export const buildCloudflare = (
    mode: string,
    root = process.cwd(),
    environment: NodeJS.ProcessEnv = process.env,
) => {
    const stage = parseAvatioStage(mode)
    requireCredentiallessApplicationEnvironment(environment)
    const selectedSources = [environment.AVATIO_SOURCE_SHA].filter((value) => value !== undefined)
    if (selectedSources.length && existsSync(resolve(root, '.env')))
        throw new Error('Delivery builds must not import local dotenv overrides.')
    const configuration = getCloudflareConfig(stage)
    const home = mkdtempSync(join(tmpdir(), 'avatio-cloudflare-build-'))
    try {
        const env = createCloudflareBuildEnvironment(stage, environment, home)
        env.PATH = `${resolve(root, 'node_modules/.bin')}${delimiter}${env.PATH ?? env.Path ?? ''}`
        delete env.Path
        const vp = resolve(root, 'node_modules/vite-plus/bin/vp')
        for (const name of [
            'XDG_CONFIG_HOME',
            'XDG_CACHE_HOME',
            'XDG_DATA_HOME',
            'XDG_STATE_HOME',
            'APPDATA',
            'LOCALAPPDATA',
        ] as const)
            mkdirSync(env[name]!, { recursive: true, mode: 0o700 })
        const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], {
            cwd: root,
            env,
            encoding: 'utf8',
        }).trim()
        if (selectedSources.some((value) => value !== sourceSha))
            throw new Error('Build checkout does not match selected source.')
        if (
            selectedSources.length &&
            execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], {
                cwd: root,
                env,
                encoding: 'utf8',
            }).trim()
        )
            throw new Error('Delivery builds require a clean selected source checkout.')
        execFileSync(
            process.execPath,
            [vp, 'exec', 'nuxt', 'prepare', '--dotenv', '.env.disabled'],
            {
                cwd: root,
                env,
                stdio: 'inherit',
            },
        )
        execFileSync(process.execPath, [vp, 'exec', 'nuxt', 'build', '--dotenv', '.env.disabled'], {
            cwd: root,
            env,
            stdio: 'inherit',
        })
        const output = resolve(root, '.output')
        const path = resolve(output, 'server/wrangler.json')
        const generated = JSON.parse(readFileSync(path, 'utf8'))
        // Nitro 2.13 writes a v1-only flag despite nodeCompat=true; the reviewed date enables v2 via nodejs_compat.
        generated.compatibility_flags = configuration.compatibility_flags
        generated.vars = { ...generated.vars, AVATIO_SOURCE_SHA: sourceSha }
        generated.d1_databases = configuration.d1_databases.map((database) => ({
            ...database,
            migrations_dir: '../../drizzle',
            migrations_pattern: '../../drizzle/*/migration.sql',
        }))
        writeFileSync(path, JSON.stringify(generated))
        assertCleanOutput(output)
        return { sourceSha, stage }
    } finally {
        rmSync(home, { recursive: true, force: true })
    }
}

if (import.meta.main) {
    try {
        const [mode, extra] = process.argv.slice(2)
        if (!mode || extra) throw new Error('One explicit target is required.')
        console.info(JSON.stringify(buildCloudflare(mode)))
    } catch (error) {
        console.error(error instanceof Error ? error.message : 'Cloudflare build failed.')
        process.exitCode = 1
    }
}
