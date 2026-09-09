import { execFile } from 'node:child_process'
import { copyFile, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

import { getStageConfig, parseAvatioStage } from '../../config/environment'
import { secretDefinitions, validateSecrets } from '../../config/secrets'

const readDotenv = async (name: string) => {
    const content = await readFile(join(process.cwd(), name), 'utf8')
    return new Map(
        content
            .split(/\r?\n/)
            .map((line) => line.match(/^([A-Z][A-Z0-9_]*)=["']?(.*?)["']?$/))
            .filter((match): match is RegExpMatchArray => Boolean(match))
            .map((match) => [match[1] ?? '', match[2] ?? '']),
    )
}

describe('stage configuration', () => {
    it('rejects missing and unknown stages instead of falling through to production', () => {
        expect(() => parseAvatioStage('')).toThrow()
        expect(() => parseAvatioStage('preview')).toThrow()
        expect(getStageConfig('production').production).toBe(true)
        expect(getStageConfig('development').production).toBe(false)
    })

    it('uses the same canonical encrypted secret names in both stages', async () => {
        const production = await readDotenv('.env.production')
        const development = await readDotenv('.env.development')
        const expected = secretDefinitions.map(({ key }) => key).sort()
        const applicationKeys = (environment: Map<string, string>) =>
            [...environment.keys()].filter((key) => !key.startsWith('DOTENV_PUBLIC_KEY')).sort()

        expect(applicationKeys(production)).toEqual(expected)
        expect(applicationKeys(development)).toEqual(expected)
        expect(production.has('DOTENV_PUBLIC_KEY_PRODUCTION')).toBe(true)
        expect(development.has('DOTENV_PUBLIC_KEY_DEVELOPMENT')).toBe(true)

        for (const key of expected) {
            expect(production.get(key)).toMatch(/^encrypted:/)
            expect(development.get(key)).toMatch(/^encrypted:/)
        }
    })

    it('keeps the dotenv private key file ignored', async () => {
        const gitignore = await readFile(join(process.cwd(), '.gitignore'), 'utf8')
        expect(gitignore.split(/\r?\n/)).toContain('.env.keys')
    })

    it('keeps secrets out of public Nuxt runtime configuration', async () => {
        const source = await readFile(join(process.cwd(), 'nuxt.config.ts'), 'utf8')
        const publicRuntimeConfig = source.match(
            /runtimeConfig:\s*\{[\s\S]*?public:\s*\{([\s\S]*?)\}\s*,?\s*\}\s*,?\s*auth:/,
        )?.[1]

        expect(publicRuntimeConfig).toBeDefined()
        expect(publicRuntimeConfig).not.toMatch(/secret|token|credential|proxyUrl/i)
        expect(publicRuntimeConfig).toContain('siteUrl')
    })

    it('maps encrypted application secrets to Alchemy secret bindings', async () => {
        const source = await readFile(join(process.cwd(), 'alchemy.run.ts'), 'utf8')

        for (const { key } of secretDefinitions) expect(source).toContain(`'${key}'`)
        expect(source).toContain("requiredSecret('BETTER_AUTH_SECRET')")
        expect(source).toContain('BETTER_AUTH_SECRET: betterAuthSecret')
        expect(source).toContain('NUXT_BETTER_AUTH_SECRET: betterAuthSecret')
        expect(source).not.toContain('BETTER_AUTH_SECRET_DEVELOPMENT')
    })

    it('defers the OG image secret to runtime so secret-free builds remain possible', async () => {
        const source = await readFile(join(process.cwd(), 'nuxt.config.ts'), 'utf8')

        expect(source).toContain("secret: '{{OG_IMAGE_SECRET}}'")
        expect(source).toContain('envExpansion: true')
        expect(source).not.toContain('process.env.OG_IMAGE_SECRET')
    })

    it('removes build-time auth secrets after Better Auth initializes', async () => {
        await promisify(execFile)(process.execPath, [
            '--input-type=module',
            '-e',
            `
            import assert from 'node:assert/strict'
            import { loadNuxt } from '@nuxt/kit'
            const secret = 'synthetic-build-secret-never-inline-123456789'
            process.env.BETTER_AUTH_SECRET = secret
            process.env.NUXT_BETTER_AUTH_SECRET = secret
            const nuxt = await loadNuxt({ cwd: process.cwd(), dev: false, ready: true })
            try {
                assert.equal(nuxt._nitro.options.runtimeConfig.betterAuthSecret, '')
                assert.ok(!JSON.stringify(nuxt._nitro.options.runtimeConfig).includes(secret))
            } finally {
                await nuxt.close()
            }
        `,
        ])
    }, 30_000)

    it('reports names and reasons without exposing supplied values', () => {
        const sensitiveValue = 'never-print-this-secret-value'
        const result = validateSecrets({
            BETTER_AUTH_SECRET: sensitiveValue,
            BOOTH_PROXY_URL: 'not-a-url',
            TWITTER_CLIENT_SECRET: sensitiveValue,
            OG_IMAGE_SECRET: sensitiveValue,
        })

        expect(result.success).toBe(false)
        if (result.success) return
        const output = JSON.stringify(result.issues)
        expect(output).toContain('BETTER_AUTH_SECRET')
        expect(output).toContain('BOOTH_PROXY_URL')
        expect(output).not.toContain(sensitiveValue)
    })

    it('stops stage commands when the dotenv private key cannot decrypt the stage file', async () => {
        const directory = await mkdtemp(join(tmpdir(), 'avatio-dotenv-'))
        try {
            await copyFile('.env.development', join(directory, '.env.development'))
            await expect(
                promisify(execFile)(
                    process.execPath,
                    [join(process.cwd(), 'scripts/stage.ts'), 'check', 'development'],
                    {
                        cwd: directory,
                        env: { ...process.env, DOTENV_PRIVATE_KEY_DEVELOPMENT: '0'.repeat(64) },
                    },
                ),
            ).rejects.toMatchObject({
                code: 1,
                stderr: expect.stringContaining('DECRYPTION_FAILED'),
            })
        } finally {
            await rm(directory, { recursive: true, force: true })
        }
    }, 30_000)

    it('requires both optional Discord settings together', () => {
        const result = validateSecrets({
            BETTER_AUTH_SECRET: 'x'.repeat(32),
            BOOTH_PROXY_URL: 'https://booth-proxy.example.com',
            TWITTER_CLIENT_SECRET: 'twitter-secret',
            OG_IMAGE_SECRET: 'x'.repeat(16),
            LIRIA_DISCORD_ENDPOINT: 'https://discord.example.com',
        })

        expect(result.success).toBe(false)
        if (result.success) return
        expect(result.issues).toContainEqual({
            name: 'LIRIA_DISCORD_ACCESS_TOKEN',
            reason: 'must be configured together with the Discord integration counterpart',
        })
    })
})
