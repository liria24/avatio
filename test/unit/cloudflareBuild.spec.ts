import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { getCloudflareConfig } from '../../config/cloudflare'
import { secretDefinitions } from '../../config/secrets'
import { buildCloudflare, createCloudflareBuildEnvironment } from '../../scripts/cloudflareBuild'

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }))
vi.mock('node:child_process', () => ({ execFileSync: execute }))

const sourceSha = 'a'.repeat(40)
const privateHome = join(tmpdir(), 'synthetic-build-home')
const baseEnv = (): NodeJS.ProcessEnv => ({
    PATH: '/synthetic/bin',
    CLOUDFLARE_API_TOKEN: 'synthetic-platform-token',
    GITHUB_TOKEN: 'synthetic-github-token',
    HOME: '/synthetic/credential-home',
    STAGE: 'production',
    PUBLIC_SITE_URL: 'https://unreviewed.example.test',
    AVATIO_SOURCE_SHA: sourceSha,
})

describe('Cloudflare build environment & wrangler patching', () => {
    it.each(['development', 'production'])(
        'isolates credentials and configures %s environment',
        (stage) => {
            const child = createCloudflareBuildEnvironment(stage, baseEnv(), privateHome)
            const config = getCloudflareConfig(stage)
            expect(child.CLOUDFLARE_API_TOKEN).toBeUndefined()
            expect(child.GITHUB_TOKEN).toBeUndefined()
            expect(child.HOME).toBe(privateHome)
            expect(child).toMatchObject({
                STAGE: stage,
                PUBLIC_SITE_URL: config.vars.PUBLIC_SITE_URL,
                R2_PUBLIC_BASE_URL: config.vars.R2_PUBLIC_BASE_URL,
                NITRO_PRESET: 'cloudflare_module',
                NODE_OPTIONS: '--max-old-space-size=4096',
                WRANGLER_SEND_METRICS: 'false',
            })
        },
    )

    it.each([
        ...secretDefinitions.slice(0, 2).map(({ key }) => key),
        'BETTER_AUTH_SECRET',
        'DOTENV_PRIVATE_KEY',
        'DOTENV_PRIVATE_KEY_DEVELOPMENT',
    ])('rejects plaintext secret or dotenv key %s', (name) => {
        expect(() =>
            createCloudflareBuildEnvironment(
                'development',
                { ...baseEnv(), [name]: 'synthetic-secret' },
                privateHome,
            ),
        ).toThrow('plaintext application secrets or dotenv private keys')
    })

    it('patches wrangler.json, disables dotenv in Nuxt, and cleans private home after build', () => {
        const root = mkdtempSync(join(tmpdir(), 'avatio-build-unit-'))
        let spawnedHome: string | undefined
        const nuxtCommands: string[][] = []
        execute
            .mockReset()
            .mockImplementation(
                (command: string, args: string[], options: { env: NodeJS.ProcessEnv }) => {
                    spawnedHome = options.env.HOME
                    if (command === 'git') return args[0] === 'rev-parse' ? `${sourceSha}\n` : ''
                    if (args[2] === 'nuxt') nuxtCommands.push(args.slice(2))
                    if (args[3] === 'build') {
                        mkdirSync(join(root, '.output/server'), { recursive: true })
                        writeFileSync(
                            join(root, '.output/server/wrangler.json'),
                            JSON.stringify({
                                vars: {},
                                d1_databases: [],
                                compatibility_flags: ['no_nodejs_compat_v2'],
                            }),
                        )
                    }
                    return ''
                },
            )
        try {
            expect(buildCloudflare('development', root, baseEnv())).toEqual({
                sourceSha,
                stage: 'development',
            })
            expect(nuxtCommands).toEqual([
                ['nuxt', 'prepare', '--dotenv', '.env.disabled'],
                ['nuxt', 'build', '--dotenv', '.env.disabled'],
            ])
            const generated = JSON.parse(
                readFileSync(join(root, '.output/server/wrangler.json'), 'utf8'),
            )
            expect(generated.compatibility_flags).toEqual(
                getCloudflareConfig('development').compatibility_flags,
            )
            expect(generated.vars.AVATIO_SOURCE_SHA).toBe(sourceSha)
            expect(generated.d1_databases[0].migrations_dir).toBe('../../drizzle')
            expect(spawnedHome && existsSync(spawnedHome)).toBe(false)

            // Non-delivery local builds permit an existing .env file (Nuxt ignores it via --dotenv).
            writeFileSync(join(root, '.env'), 'STAGE=production\n')
            const { AVATIO_SOURCE_SHA: localSha, ...localEnv } = baseEnv()
            expect(localSha).toBe(sourceSha)
            expect(buildCloudflare('development', root, localEnv)).toEqual({
                sourceSha,
                stage: 'development',
            })
        } finally {
            rmSync(root, { recursive: true, force: true })
        }
    })

    it('rejects mismatched SHA, dirty delivery checkout, and dotenv overrides on delivery', () => {
        const root = mkdtempSync(join(tmpdir(), 'avatio-build-reject-'))
        try {
            execute
                .mockReset()
                .mockImplementation((_c: string, args: string[]) =>
                    args[0] === 'rev-parse' ? `${sourceSha}\n` : ' M nuxt.config.ts\n',
                )
            expect(() =>
                buildCloudflare('development', root, {
                    ...baseEnv(),
                    AVATIO_SOURCE_SHA: 'b'.repeat(40),
                }),
            ).toThrow('does not match selected source')
            expect(() => buildCloudflare('development', root, baseEnv())).toThrow(
                'clean selected source checkout',
            )

            writeFileSync(join(root, '.env'), 'STAGE=production\n')
            expect(() => buildCloudflare('development', root, baseEnv())).toThrow(
                'dotenv overrides',
            )
        } finally {
            rmSync(root, { recursive: true, force: true })
        }
    })
})
