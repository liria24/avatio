import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
    appendFileSync,
    existsSync,
    readFileSync,
    readdirSync,
    lstatSync,
    writeFileSync,
    mkdirSync,
} from 'node:fs'
import { resolve, relative } from 'node:path'

import { createCloudflareWranglerConfig } from '../config/cloudflareWrangler.ts'
import { parseAvatioStage } from '../config/environment.ts'
import { secretDefinitions } from '../config/secrets.ts'
import { readCommittedCloudflareMigrations } from './cloudflareMigrationHistory.ts'

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

export const buildCloudflare = (mode: string, inventory: unknown, root = process.cwd()) => {
    const stage = parseAvatioStage(mode)
    if (
        [
            'CLOUDFLARE_API_TOKEN',
            'DOTENV_PRIVATE_KEY',
            'DOTENV_PRIVATE_KEY_PRODUCTION',
            'DOTENV_PRIVATE_KEY_DEVELOPMENT',
            'BETTER_AUTH_SECRET',
            ...secretDefinitions.map(({ key }) => key),
        ].some((name) => process.env[name])
    )
        throw new Error('Application builds must not receive deployment or signing credentials.')
    if (existsSync(resolve(root, '.env')))
        throw new Error('Deployed builds must not import local dotenv overrides.')
    const configuration = createCloudflareWranglerConfig(stage, inventory)
    const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: root,
        encoding: 'utf8',
    }).trim()
    if (process.env.AVATIO_SOURCE_SHA && process.env.AVATIO_SOURCE_SHA !== sourceSha)
        throw new Error('Build checkout does not match selected source.')
    if (
        process.env.AVATIO_SOURCE_SHA &&
        execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], {
            cwd: root,
            encoding: 'utf8',
        }).trim()
    )
        throw new Error('Delivery builds require a clean selected source checkout.')
    const env = {
        ...process.env,
        STAGE: stage,
        PREVIEW_NAME: stage === 'development' ? 'development' : '',
        PUBLIC_SITE_URL: String(configuration.vars.PUBLIC_SITE_URL),
        R2_PUBLIC_BASE_URL: String(configuration.vars.R2_PUBLIC_BASE_URL),
        AVATIO_CF_RESOURCES_JSON: JSON.stringify(inventory),
        NITRO_PRESET: 'cloudflare_module',
        NODE_OPTIONS: '--max-old-space-size=4096',
        WRANGLER_SEND_METRICS: 'false',
    }
    execFileSync(process.platform === 'win32' ? 'vp.cmd' : 'vp', ['run', 'build'], {
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
    for (const file of readCommittedCloudflareMigrations(root)) {
        const destination = resolve(output, 'migrations', file.name)
        mkdirSync(resolve(destination, '..'), { recursive: true })
        writeFileSync(destination, file.sql)
    }
    const artifactHash = hashCloudflareArtifact(output)
    writeFileSync(
        resolve(output, 'delivery.json'),
        JSON.stringify({ sourceSha, stage, artifactHash }),
    )
    if (process.env.GITHUB_OUTPUT)
        appendFileSync(
            process.env.GITHUB_OUTPUT,
            `source_sha=${sourceSha}\nartifact_sha256=${artifactHash}\n`,
        )
    return { sourceSha, stage, artifactHash }
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
        console.error('Cloudflare build stopped; deployment and signing credentials are forbidden.')
        process.exitCode = 1
    }
}
