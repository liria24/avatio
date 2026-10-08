import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
    existsSync,
    readFileSync,
    readdirSync,
    lstatSync,
    writeFileSync,
    mkdirSync,
    mkdtempSync,
    rmSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, relative, join, delimiter } from 'node:path'

import { createCloudflareWranglerConfig } from '../config/cloudflareWrangler.ts'
import { parseAvatioStage } from '../config/environment.ts'
import { secretDefinitions } from '../config/secrets.ts'
import { readCommittedCloudflareMigrations } from './cloudflareMigrationHistory.ts'
import { createCloudflareProcessEnvironment } from './cloudflareProcessEnvironment.ts'

/** Hash data and application files without importing or evaluating artifact code. */
export const hashCloudflareArtifact = (root: string) => {
    const files = readdirSync(root, { recursive: true, withFileTypes: true })
        .map((entry) => resolve(entry.parentPath, entry.name))
        .sort()
    const hash = createHash('sha256')
    for (const file of files) {
        const metadata = lstatSync(file)
        if (metadata.isSymbolicLink()) throw new Error('Artifact symlinks are not permitted.')
        if (metadata.isDirectory()) continue
        if (!metadata.isFile()) throw new Error('Artifact contains an unsupported file.')
        const name = relative(root, file).replaceAll('\\', '/')
        if (name === 'delivery.json') continue
        if (name.split('/').some((part) => part.startsWith('.env')))
            throw new Error('Environment files are not permitted in application artifacts.')
        hash.update(name).update('\0').update(readFileSync(file)).update('\0')
    }
    return hash.digest('hex')
}

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

/** The publisher may retain its platform token; no credential is inherited by build children. */
export const createCloudflareBuildEnvironment = (
    mode: string,
    inventory: unknown,
    environment: NodeJS.ProcessEnv,
    home: string,
): NodeJS.ProcessEnv => {
    requireCredentiallessApplicationEnvironment(environment)
    const stage = parseAvatioStage(mode)
    const configuration = createCloudflareWranglerConfig(stage, inventory)
    return {
        ...createCloudflareProcessEnvironment(environment, home),
        STAGE: stage,
        PREVIEW_NAME: stage === 'development' ? 'development' : '',
        PUBLIC_SITE_URL: String(configuration.vars.PUBLIC_SITE_URL),
        R2_PUBLIC_BASE_URL: String(configuration.vars.R2_PUBLIC_BASE_URL),
        AVATIO_CF_RESOURCES_JSON: JSON.stringify(inventory),
        NITRO_PRESET: 'cloudflare_module',
        NODE_OPTIONS: '--max-old-space-size=4096',
        WRANGLER_SEND_METRICS: 'false',
    }
}

export const buildCloudflare = (
    mode: string,
    inventory: unknown,
    root = process.cwd(),
    environment: NodeJS.ProcessEnv = process.env,
) => {
    const stage = parseAvatioStage(mode)
    requireCredentiallessApplicationEnvironment(environment)
    if (existsSync(resolve(root, '.env')))
        throw new Error('Deployed builds must not import local dotenv overrides.')
    const configuration = createCloudflareWranglerConfig(stage, inventory)
    const home = mkdtempSync(join(tmpdir(), 'avatio-cloudflare-build-'))
    try {
        const env = createCloudflareBuildEnvironment(stage, inventory, environment, home)
        env.PATH = `${resolve(root, 'node_modules/.bin')}${delimiter}${env.PATH ?? env.Path ?? ''}`
        delete env.Path
        const vp = resolve(
            root,
            'node_modules/.bin',
            process.platform === 'win32' ? 'vp.cmd' : 'vp',
        )
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
        const selectedSources = [
            environment.WORKERS_CI_COMMIT_SHA,
            environment.AVATIO_SOURCE_SHA,
        ].filter((value) => value !== undefined)
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
        execFileSync(vp, ['exec', 'nuxt', 'prepare'], {
            cwd: root,
            env,
            stdio: 'inherit',
        })
        execFileSync(vp, ['run', 'build'], {
            cwd: root,
            env,
            stdio: 'inherit',
        })
        const output = resolve(root, '.output')
        const path = resolve(output, 'server/wrangler.json')
        const generated = JSON.parse(readFileSync(path, 'utf8'))
        // Nitro 2.13.4 writes a v1-only flag despite nodeCompat=true. The reviewed
        // date enables v2 through nodejs_compat. Only this generated setting changes;
        // the official Nitro entrypoint, assets and modules are used unchanged.
        generated.compatibility_flags = configuration.compatibility_flags
        writeFileSync(path, JSON.stringify(generated))
        for (const file of readCommittedCloudflareMigrations(root, env)) {
            const destination = resolve(output, 'migrations', file.name)
            mkdirSync(resolve(destination, '..'), { recursive: true })
            writeFileSync(destination, file.sql)
        }
        const artifactHash = hashCloudflareArtifact(output)
        writeFileSync(
            resolve(output, 'delivery.json'),
            JSON.stringify({ sourceSha, stage, artifactHash }),
        )
        return { sourceSha, stage, artifactHash }
    } finally {
        rmSync(home, { recursive: true, force: true })
    }
}

if (import.meta.main) {
    try {
        const [mode, extra] = process.argv.slice(2)
        if (!mode || extra) throw new Error('One explicit target is required.')
        console.info(
            JSON.stringify(
                buildCloudflare(mode, JSON.parse(process.env.AVATIO_CF_RESOURCES_JSON ?? '')),
            ),
        )
    } catch {
        console.error(
            'Cloudflare build stopped; plaintext application secrets and dotenv private keys are forbidden.',
        )
        process.exitCode = 1
    }
}
