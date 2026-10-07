import { execFile } from 'node:child_process'
import { copyFile, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

import { secretDefinitions } from '../../config/secrets'

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
    it('uses only declared encrypted secret names and includes every required secret', async () => {
        const production = await readDotenv('.env.production')
        const development = await readDotenv('.env.development')
        const declared = new Set(secretDefinitions.map(({ key }) => key))
        const required = secretDefinitions.filter((secret) => secret.required).map(({ key }) => key)
        const applicationKeys = (environment: Map<string, string>) =>
            [...environment.keys()].filter((key) => !key.startsWith('DOTENV_PUBLIC_KEY')).sort()

        expect(production.has('DOTENV_PUBLIC_KEY_PRODUCTION')).toBe(true)
        expect(development.has('DOTENV_PUBLIC_KEY_DEVELOPMENT')).toBe(true)

        for (const environment of [production, development]) {
            const keys = applicationKeys(environment)
            expect(
                keys.every((key) => declared.has(key as (typeof secretDefinitions)[number]['key'])),
            ).toBe(true)
            for (const key of required) expect(environment.get(key)).toMatch(/^encrypted:/)
            for (const key of keys) expect(environment.get(key)).toMatch(/^encrypted:/)
        }
    })

    it('keeps the dotenv private key file ignored', async () => {
        await expect(
            execFileAsync('git', ['check-ignore', '--quiet', '.env.keys'], {
                cwd: process.cwd(),
            }),
        ).resolves.toBeDefined()
    })

    it.each([
        ['production', ''],
        ['development', ''],
        ['development', 'development'],
        ['development', 'pr-354'],
    ])(
        'keeps secrets out of Nuxt configuration for %s / %s',
        async (stage, preview) => {
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
            process.env.STAGE = ${JSON.stringify(stage)}
            process.env.PREVIEW_NAME = ${JSON.stringify(preview)}
            process.env.PUBLIC_SITE_URL = 'https://preview.example.test'
            process.env.R2_PUBLIC_BASE_URL = 'https://preview-images.example.test'
            process.env.OG_IMAGE_ENDPOINT = 'https://preview-og.example.test'
            const preview = Boolean(process.env.PREVIEW_NAME)
            const pr = process.env.PREVIEW_NAME.startsWith('pr-')
            const siteUrl = preview ? process.env.PUBLIC_SITE_URL
                : process.env.STAGE === 'production' ? 'https://avatio.me' : 'https://dev.avatio.me'
            const nuxt = await loadNuxt({ cwd: process.cwd(), dev: false, ready: true })
            try {
                const runtimeConfig = nuxt._nitro.options.runtimeConfig
                const serialized = JSON.stringify(runtimeConfig)
                const publicSerialized = JSON.stringify(runtimeConfig.public)
                assert.equal(runtimeConfig.betterAuthSecret, '')
                if (!preview) assert.equal(runtimeConfig.ogImage.secret, '{{OG_IMAGE_SECRET}}')
                assert.equal(runtimeConfig.public.siteUrl, siteUrl)
                assert.equal(nuxt.options.appConfig.app.site, siteUrl)
                assert.equal(nuxt.options.i18n.baseUrl, siteUrl)
                assert.equal(runtimeConfig.public.emailPasswordAuthEnabled, pr)
                assert.equal(runtimeConfig.public.twitterAuthEnabled, !pr)
                assert.equal(nuxt.options.image.provider, pr ? 'none' : 'cloudflare')
                if (preview) {
                    assert.equal(runtimeConfig.ogImage, undefined)
                    assert.equal(nuxt._nitro.options.handlers.some(handler => handler.route === '/api/og-image'), false)
                    assert.ok(nuxt.options.imports.imports.some(entry => entry.name === 'useDisabledOgImage' && entry.as === 'useOgImage'))
                    assert.deepEqual(nuxt._nitro.options.scheduledTasks, {})
                    assert.equal(runtimeConfig.cloudflare.apiToken, '')
                    assert.equal(runtimeConfig.cloudflare.siteTag, '')
                }
                assert.ok(!serialized.includes(authSecret))
                assert.ok(!serialized.includes(ogSecret))
                assert.ok(!/(secret|token|credential|proxyUrl)/i.test(publicSerialized))
            } finally {
                await nuxt.close()
            }
        `,
            ])
        },
        30_000,
    )

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
})
