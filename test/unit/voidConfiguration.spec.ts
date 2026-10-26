import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { getBuildEnvironment } from '../../config/build'
import { getStageConfig } from '../../config/environment'
import { getVoidConfig } from '../../config/void'
import { prepareVoid } from '../../scripts/prepareVoid'

describe('reviewed Void target selection', () => {
    it('resolves public stage settings without secrets and keeps email/password local', () => {
        expect(getBuildEnvironment({ STAGE: 'production' }, false)).toMatchObject({
            siteUrl: 'https://avatio.me',
            twitterAuthEnabled: true,
            emailPasswordAuthEnabled: false,
        })
        expect(getBuildEnvironment({ STAGE: 'development' }, false)).toMatchObject({
            siteUrl: 'https://dev.avatio.me',
            twitterAuthEnabled: true,
            emailPasswordAuthEnabled: false,
        })
        expect(getBuildEnvironment({}, true)).toMatchObject({
            siteUrl: 'http://localhost:3000',
            emailPasswordAuthEnabled: true,
        })
        expect(() => getBuildEnvironment({ STAGE: 'staging' }, false)).toThrow()
    })
    it.each(['development', 'production'])(
        'copies only the %s config and lock without provisioning',
        (stage) => {
            const root = mkdtempSync(join(tmpdir(), 'avatio-void-config-'))
            try {
                cpSync(new URL('../../deployment/', import.meta.url), join(root, 'deployment'), {
                    recursive: true,
                })
                const config = getVoidConfig(stage)
                expect(prepareVoid(stage, root)).toEqual(config.cloudflare)
                for (const name of ['void.config.ts', 'void.lock.json'])
                    expect(readFileSync(join(root, name))).toEqual(
                        readFileSync(join(root, 'deployment', stage, name)),
                    )
                expect(
                    JSON.parse(readFileSync(join(root, '.void-wrangler.jsonc'), 'utf8')),
                ).toEqual(config.cloudflare)
                expect(config.inference.bindings).toEqual({
                    db: false,
                    kv: false,
                    storage: false,
                    ai: false,
                    email: false,
                })
                expect(config.inference.build).toBe(`node scripts/cloudflareBuild.ts ${stage}`)
                const runtime = getStageConfig(stage)
                expect(config.cloudflare.vars.STAGE).toBe(stage)
                expect(config.cloudflare.routes).toEqual([
                    { pattern: new URL(runtime.siteUrl).host, custom_domain: true },
                ])
                expect(config.cloudflare.d1_databases).toEqual([
                    expect.objectContaining({
                        binding: 'APP_DB',
                        database_name: runtime.infrastructure.appDatabase,
                        migrations_pattern: 'drizzle/*/migration.sql',
                        migrations_table: 'd1_migrations',
                    }),
                ])
                expect(config.cloudflare.r2_buckets).toEqual([
                    { binding: 'R2', bucket_name: runtime.infrastructure.bucket },
                ])
                expect(config.cloudflare.queues.consumers).toEqual([
                    {
                        queue: runtime.infrastructure.queue,
                        max_batch_size: 10,
                        max_batch_timeout: 5,
                        max_retries: 3,
                    },
                ])
                expect(config.cloudflare.triggers.crons).toEqual(['0 22 * * *'])
                expect(config.cloudflare.preview_urls).toBe(false)
                expect(config.cloudflare.secrets.required).toContain('NUXT_BETTER_AUTH_SECRET')
                expect(config.cloudflare.vars).not.toHaveProperty('NUXT_BETTER_AUTH_SECRET')
            } finally {
                rmSync(root, { recursive: true, force: true })
            }
        },
    )

    it('rejects unknown stages, resource drift, and altered resolved locks before creating root files', () => {
        expect(() => getVoidConfig('preview')).toThrow('Stage')
        const root = mkdtempSync(join(tmpdir(), 'avatio-void-config-'))
        try {
            cpSync(new URL('../../deployment/', import.meta.url), join(root, 'deployment'), {
                recursive: true,
            })
            const path = join(root, 'deployment/development/void.lock.json')
            const original = readFileSync(path, 'utf8')
            for (const part of ['source', 'resolved', 'text'] as const) {
                const lock = JSON.parse(original)
                if (part === 'text') lock.text = JSON.stringify({ name: 'unreviewed' })
                else
                    lock[part].d1_databases[0].database_id =
                        getVoidConfig('production').cloudflare.d1_databases[0]!.database_id
                writeFileSync(path, JSON.stringify(lock))
                expect(() => prepareVoid('development', root)).toThrow('reviewed')
                expect(existsSync(join(root, 'void.config.ts'))).toBe(false)
            }
        } finally {
            rmSync(root, { recursive: true, force: true })
        }
    })

    it('keeps development resources and capabilities separate from production', () => {
        const development = getVoidConfig('development').cloudflare
        const production = getVoidConfig('production').cloudflare
        for (const key of [
            'name',
            'd1_databases',
            'kv_namespaces',
            'r2_buckets',
            'flagship',
            'ratelimits',
        ] as const)
            expect(development[key]).not.toEqual(production[key])
        expect(development.send_email[0]).toMatchObject({
            allowed_sender_addresses: ['hello@avatio.me'],
            allowed_destination_addresses: ['hello@liria.me'],
        })
        expect(development.secrets.required).toEqual([
            'NUXT_BETTER_AUTH_SECRET',
            'TWITTER_CLIENT_SECRET',
            'OG_IMAGE_SECRET',
        ])
        expect(
            Object.keys(development.vars).some((name) => /ANALYTICS|SEARCH_CONSOLE/.test(name)),
        ).toBe(false)
        expect(() =>
            getBuildEnvironment({ STAGE: 'development', PREVIEW_NAME: 'development' }, false),
        ).toThrow()
        expect(() =>
            getBuildEnvironment(
                { STAGE: 'development', PUBLIC_SITE_URL: 'https://avatio.me' },
                false,
            ),
        ).toThrow()
    })
})
