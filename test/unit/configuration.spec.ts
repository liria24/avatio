import { execFile } from 'node:child_process'
import { copyFile, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

import { getStageConfig, parseAvatioStage } from '../../config/environment'
import { secretDefinitions, validateSecrets } from '../../config/secrets'

const execFileAsync = promisify(execFile)

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
        await expect(
            execFileAsync('git', ['check-ignore', '--quiet', '.env.keys'], {
                cwd: process.cwd(),
            }),
        ).resolves.toBeDefined()
    })

    it('keeps secrets out of generated Nuxt runtime configuration', async () => {
        await execFileAsync(process.execPath, [
            '--input-type=module',
            '-e',
            `
            import assert from 'node:assert/strict'
            import { loadNuxt } from '@nuxt/kit'
            const authSecret = 'synthetic-build-secret-never-inline-123456789'
            const ogSecret = 'synthetic-og-secret-never-inline-123456789'
            process.env.BETTER_AUTH_SECRET = authSecret
            process.env.NUXT_BETTER_AUTH_SECRET = authSecret
            process.env.OG_IMAGE_SECRET = ogSecret
            const nuxt = await loadNuxt({ cwd: process.cwd(), dev: false, ready: true })
            try {
                const runtimeConfig = nuxt._nitro.options.runtimeConfig
                const serialized = JSON.stringify(runtimeConfig)
                const publicSerialized = JSON.stringify(runtimeConfig.public)
                assert.equal(runtimeConfig.betterAuthSecret, '')
                assert.equal(runtimeConfig.ogImage.secret, '{{OG_IMAGE_SECRET}}')
                assert.match(runtimeConfig.public.siteUrl, /^https?:\\/\\//)
                assert.ok(!serialized.includes(authSecret))
                assert.ok(!serialized.includes(ogSecret))
                assert.ok(!/(secret|token|credential|proxyUrl)/i.test(publicSerialized))
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
                execFileAsync(
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
