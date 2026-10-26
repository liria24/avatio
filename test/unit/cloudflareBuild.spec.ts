import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { secretDefinitions } from '../../config/secrets'
import { getVoidConfig } from '../../config/void'
import {
    buildCloudflare,
    createCloudflareBuildEnvironment,
    hashCloudflareArtifact,
} from '../../scripts/cloudflareBuild'

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }))
vi.mock('node:child_process', () => ({ execFileSync: execute }))

const sourceSha = 'a'.repeat(40)
const syntheticEnvironment = (): NodeJS.ProcessEnv => ({
    PATH: '/synthetic/bin',
    SystemRoot: '/synthetic/system',
    PATHEXT: '.EXE;.CMD',
    TEMP: '/synthetic/temp',
    TMP: '/synthetic/tmp',
    TMPDIR: '/synthetic/tmpdir',
    LANG: 'en_US.UTF-8',
    HTTP_PROXY: 'http://proxy.example.test:8080',
    HTTPS_PROXY: 'http://proxy.example.test:8080',
    ALL_PROXY: 'http://proxy.example.test:8080',
    NO_PROXY: 'localhost,127.0.0.1',
    http_proxy: 'http://proxy.example.test:8080',
    https_proxy: 'http://proxy.example.test:8080',
    all_proxy: 'http://proxy.example.test:8080',
    no_proxy: 'localhost,127.0.0.1',
    NODE_USE_ENV_PROXY: '1',
    NODE_EXTRA_CA_CERTS: '/synthetic/proxy-ca.pem',
    CLOUDFLARE_API_TOKEN: 'synthetic-platform-token',
    CLOUDFLARE_API_KEY: 'synthetic-cloudflare-key',
    CLOUDFLARE_EMAIL: 'synthetic@example.test',
    CLOUDFLARE_ACCOUNT_ID: 'f'.repeat(32),
    CF_API_TOKEN: 'synthetic-cf-alias-token',
    GITHUB_TOKEN: 'synthetic-github-token',
    GH_TOKEN: 'synthetic-gh-token',
    AWS_SECRET_ACCESS_KEY: 'synthetic-aws-secret',
    npm_config_token: 'synthetic-registry-token',
    HOME: '/synthetic/credential-home',
    USERPROFILE: '/synthetic/credential-home',
    XDG_CONFIG_HOME: '/synthetic/credential-config',
    XDG_CACHE_HOME: '/synthetic/credential-cache',
    XDG_DATA_HOME: '/synthetic/credential-data',
    APPDATA: '/synthetic/credential-appdata',
    LOCALAPPDATA: '/synthetic/credential-localappdata',
    NODE_OPTIONS: '--require=/synthetic/unsafe-preload.cjs',
    NODE_TLS_REJECT_UNAUTHORIZED: '0',
    STAGE: 'production',
    PUBLIC_SITE_URL: 'https://unreviewed.example.test',
    NITRO_PRESET: 'unreviewed',
    GITHUB_OUTPUT: '/synthetic/obsolete-output',
    AVATIO_SOURCE_SHA: sourceSha,
})
const privateHome = join(tmpdir(), 'synthetic-build-home')

const expectNoCredentials = (environment: NodeJS.ProcessEnv) => {
    for (const name of [
        'CLOUDFLARE_API_TOKEN',
        'CLOUDFLARE_API_KEY',
        'CLOUDFLARE_EMAIL',
        'CLOUDFLARE_ACCOUNT_ID',
        'CF_API_TOKEN',
        'GITHUB_TOKEN',
        'GH_TOKEN',
        'AWS_SECRET_ACCESS_KEY',
        'npm_config_token',
        'GITHUB_OUTPUT',
        'WORKERS_CI_COMMIT_SHA',
        'DOTENV_PRIVATE_KEY',
        'DOTENV_PRIVATE_KEY_DEVELOPMENT',
        'BETTER_AUTH_SECRET',
        ...secretDefinitions.map(({ key }) => key),
    ])
        expect(environment[name]).toBeUndefined()
    expect(JSON.stringify(environment)).not.toContain('synthetic-platform-token')
    expect(JSON.stringify(environment)).not.toContain('synthetic-credential')
}

describe('Cloudflare build child environment', () => {
    it.each(['development', 'production'])(
        'isolates credentials and applies reviewed %s configuration without mutations',
        (mode) => {
            const outer = syntheticEnvironment()
            const original = { ...outer }
            const globalEnvironment = process.env
            const child = createCloudflareBuildEnvironment(mode, outer, privateHome)
            const config = getVoidConfig(mode).cloudflare
            expectNoCredentials(child)
            expect(child).toMatchObject({
                PATH: outer.PATH,
                SystemRoot: outer.SystemRoot,
                PATHEXT: outer.PATHEXT,
                TEMP: outer.TEMP,
                TMP: outer.TMP,
                TMPDIR: outer.TMPDIR,
                LANG: outer.LANG,
                HTTP_PROXY: outer.HTTP_PROXY,
                HTTPS_PROXY: outer.HTTPS_PROXY,
                ALL_PROXY: outer.ALL_PROXY,
                NO_PROXY: outer.NO_PROXY,
                http_proxy: outer.http_proxy,
                https_proxy: outer.https_proxy,
                all_proxy: outer.all_proxy,
                no_proxy: outer.no_proxy,
                NODE_USE_ENV_PROXY: '1',
                NODE_EXTRA_CA_CERTS: outer.NODE_EXTRA_CA_CERTS,
                HOME: privateHome,
                USERPROFILE: privateHome,
                XDG_CONFIG_HOME: join(privateHome, 'config'),
                XDG_CACHE_HOME: join(privateHome, 'cache'),
                XDG_DATA_HOME: join(privateHome, 'data'),
                XDG_STATE_HOME: join(privateHome, 'state'),
                APPDATA: join(privateHome, 'AppData', 'Roaming'),
                LOCALAPPDATA: join(privateHome, 'AppData', 'Local'),
                STAGE: mode,
                PUBLIC_SITE_URL: config.vars.PUBLIC_SITE_URL,
                R2_PUBLIC_BASE_URL: config.vars.R2_PUBLIC_BASE_URL,
                NITRO_PRESET: 'cloudflare_module',
                NODE_OPTIONS: '--max-old-space-size=4096',
                WRANGLER_SEND_METRICS: 'false',
            })
            expect(child.NODE_TLS_REJECT_UNAUTHORIZED).toBeUndefined()
            expect(outer).toEqual(original)
            expect(process.env).toBe(globalEnvironment)
        },
    )
    it('does not inherit future or unknown environment variables', () => {
        const child = createCloudflareBuildEnvironment(
            'development',
            {
                PATH: '/synthetic/bin',
                NEW_PLATFORM_CREDENTIAL: 'synthetic-new-credential',
                NUXT_PUBLIC_UNREVIEWED_SETTING: 'unreviewed',
                GIT_CONFIG_COUNT: '1',
                GIT_CONFIG_KEY_0: 'credential.helper',
                GIT_CONFIG_VALUE_0: 'synthetic-helper',
            },
            privateHome,
        )
        expect(child.NEW_PLATFORM_CREDENTIAL).toBeUndefined()
        expect(child.NUXT_PUBLIC_UNREVIEWED_SETTING).toBeUndefined()
        expect(child.GIT_CONFIG_COUNT).toBeUndefined()
        expect(child.GIT_CONFIG_KEY_0).toBeUndefined()
        expect(child.GIT_CONFIG_VALUE_0).toBeUndefined()
    })
    it.each([
        ...secretDefinitions.map(({ key }) => key),
        'BETTER_AUTH_SECRET',
        'NUXT_BETTER_AUTH_SECRET_PRODUCTION',
        'AVATIO_SIGNING_SECRET',
        'DOTENV_PRIVATE_KEY',
        'DOTENV_PRIVATE_KEY_DEVELOPMENT',
        'DOTENV_PRIVATE_KEY_PRODUCTION',
        'DOTENV_PRIVATE_KEY_UNEXPECTED_STAGE',
    ])('fails closed on plaintext app credentials or dotenv keys: %s', (name) => {
        expect(() =>
            createCloudflareBuildEnvironment(
                'development',
                {
                    ...syntheticEnvironment(),
                    [name]: 'synthetic-forbidden-value',
                },
                privateHome,
            ),
        ).toThrow('plaintext application secrets or dotenv private keys')
    })
})

describe('Void standard application build', () => {
    let root: string
    let spawnedHome: string | undefined
    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), 'avatio-build-unit-'))
        spawnedHome = undefined
        execute.mockReset()
        execute.mockImplementation(
            (command: string, args: string[], options: { env: NodeJS.ProcessEnv }) => {
                expectNoCredentials(options.env)
                expect(options.env.HOME).not.toBe('/synthetic/credential-home')
                expect(existsSync(options.env.HOME!)).toBe(true)
                spawnedHome = options.env.HOME
                if (command === 'git') {
                    if (args[0] === 'rev-parse') return `${sourceSha}\n`
                    if (args[0] === 'status') return ''
                    throw new Error('Unexpected Git command')
                }
                expect(command).toBe(process.execPath)
                expect(args.shift()).toBe(join(root, 'node_modules/vite-plus/bin/vp'))
                expect(options.env.PATH).toContain(join(root, 'node_modules/.bin'))
                if (args[0] === 'exec') {
                    expect(args).toEqual(['exec', 'nuxt', 'prepare'])
                    return ''
                }
                expect(args).toEqual(['run', 'build'])
                expect(existsSync(options.env.XDG_CONFIG_HOME!)).toBe(true)
                expect(existsSync(options.env.XDG_CACHE_HOME!)).toBe(true)
                const output = join(root, '.output')
                mkdirSync(join(output, 'server'), { recursive: true })
                mkdirSync(join(output, 'public'), { recursive: true })
                const configuration = getVoidConfig('development').cloudflare
                writeFileSync(
                    join(output, 'server/wrangler.json'),
                    JSON.stringify({
                        ...configuration,
                        main: 'index.mjs',
                        assets: {
                            binding: 'ASSETS',
                            directory: '../public',
                            run_worker_first: true,
                        },
                        compatibility_flags: [
                            ...configuration.compatibility_flags,
                            'no_nodejs_compat_v2',
                        ],
                    }),
                )
                writeFileSync(join(output, 'server/index.mjs'), 'export default {}')
                writeFileSync(join(output, 'public/sw.js'), 'synthetic asset')
                return ''
            },
        )
    })
    afterEach(() => {
        rmSync(root, { recursive: true, force: true })
        if (spawnedHome) expect(existsSync(spawnedHome)).toBe(false)
    })
    it('accepts the outer platform token and verifies source with clean Git/vp environments', () => {
        const outer = syntheticEnvironment()
        const original = { ...outer }
        const receipt = buildCloudflare('development', root, outer)
        expect(receipt).toEqual({
            sourceSha,
            stage: 'development',
            artifactHash: hashCloudflareArtifact(join(root, '.output')),
        })
        const generated = JSON.parse(
            readFileSync(join(root, '.output/server/wrangler.json'), 'utf8'),
        )
        expect(generated.compatibility_flags).toEqual(
            getVoidConfig('development').cloudflare.compatibility_flags,
        )
        expect(generated.main).toBe('index.mjs')
        expect(readFileSync(join(root, '.output/server/index.mjs'), 'utf8')).toBe(
            'export default {}',
        )
        expect(JSON.parse(readFileSync(join(root, '.output/delivery.json'), 'utf8'))).toEqual(
            receipt,
        )
        expect(execute.mock.calls.map(([, args]) => args)).toEqual([
            ['rev-parse', 'HEAD'],
            ['status', '--porcelain', '--untracked-files=no'],
            ['exec', 'nuxt', 'prepare'],
            ['run', 'build'],
        ])
        expect(outer).toEqual(original)
        expect(outer.CLOUDFLARE_API_TOKEN).toBe('synthetic-platform-token')
        expect(existsSync(outer.GITHUB_OUTPUT!)).toBe(false)
    })
    it('leaves the global publisher environment unchanged', () => {
        const globalEnvironment = {
            CLOUDFLARE_API_TOKEN: 'synthetic-global-platform-token',
            GITHUB_TOKEN: 'synthetic-global-github-token',
            HOME: '/synthetic/global-credential-home',
            SYNTHETIC_SENTINEL: 'unchanged',
        }
        const original = { ...globalEnvironment }
        vi.stubGlobal('process', { ...process, env: globalEnvironment })
        try {
            buildCloudflare('development', root, syntheticEnvironment())
            expect(process.env).toBe(globalEnvironment)
            expect(process.env).toEqual(original)
        } finally {
            vi.unstubAllGlobals()
        }
    })
    it.each(['b'.repeat(40), '', 'not-a-sha'])(
        'rejects a mismatched delivery commit %s before Nuxt',
        (sha) => {
            expect(() =>
                buildCloudflare('development', root, {
                    ...syntheticEnvironment(),
                    AVATIO_SOURCE_SHA: sha,
                }),
            ).toThrow('does not match selected source')
            expect(execute).toHaveBeenCalledTimes(1)
        },
    )
    it('rejects tracked edits when delivery selects the checkout', () => {
        execute
            .mockImplementationOnce(
                (_: string, __: string[], options: { env: NodeJS.ProcessEnv }) => {
                    spawnedHome = options.env.HOME
                    return sourceSha
                },
            )
            .mockImplementationOnce(() => ' M nuxt.config.ts\n')
        expect(() => buildCloudflare('development', root, syntheticEnvironment())).toThrow(
            'clean selected source checkout',
        )
        expect(execute).toHaveBeenCalledTimes(2)
    })
    it('permits local uncommitted iteration only when no platform commit is selected', () => {
        const outer = syntheticEnvironment()
        delete outer.AVATIO_SOURCE_SHA
        expect(buildCloudflare('development', root, outer).stage).toBe('development')
        expect(execute.mock.calls.some(([, args]) => args[0] === 'status')).toBe(false)
    })
    it('rejects dotenv overrides and plaintext secrets before spawning any command', () => {
        writeFileSync(join(root, '.env'), 'synthetic override')
        expect(() => buildCloudflare('development', root, syntheticEnvironment())).toThrow(
            'dotenv overrides',
        )
        rmSync(join(root, '.env'))
        expect(() =>
            buildCloudflare('development', root, {
                ...syntheticEnvironment(),
                NUXT_BETTER_AUTH_SECRET: 'synthetic-signing-value',
            }),
        ).toThrow('plaintext application secrets')
        expect(execute).not.toHaveBeenCalled()
    })
    it('cleans its private credential-cache home if the build child fails', () => {
        execute
            .mockImplementationOnce(
                (_: string, __: string[], options: { env: NodeJS.ProcessEnv }) => {
                    spawnedHome = options.env.HOME
                    return sourceSha
                },
            )
            .mockImplementationOnce(() => '')
            .mockImplementationOnce(() => {
                throw new Error('synthetic build failure')
            })
        expect(() => buildCloudflare('development', root, syntheticEnvironment())).toThrow(
            'synthetic build failure',
        )
    })
})
