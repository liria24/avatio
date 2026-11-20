import { getBuildEnvironment } from '../../config/build'
import { getCloudflareConfig } from '../../config/cloudflare'
import { getStageConfig } from '../../config/environment'

describe('reviewed Worker target configuration', () => {
    it.each(['development', 'production'])(
        'retains the %s resources and runtime contract',
        (stage) => {
            const config = getCloudflareConfig(stage)
            const runtime = getStageConfig(stage)
            expect(config.name).toBe(runtime.infrastructure.appDatabase)
            expect(config.vars.STAGE).toBe(stage)
            expect(config.routes).toEqual([
                { pattern: new URL(runtime.siteUrl).host, custom_domain: true },
            ])
            expect(config.d1_databases).toEqual([
                expect.objectContaining({
                    binding: 'APP_DB',
                    database_name: runtime.infrastructure.appDatabase,
                    migrations_dir: '../../drizzle',
                    migrations_pattern: '../../drizzle/*/migration.sql',
                    migrations_table: 'd1_migrations',
                }),
            ])
            expect(config.r2_buckets).toEqual([
                { binding: 'R2', bucket_name: runtime.infrastructure.bucket },
            ])
            expect(config.queues.consumers).toEqual([
                {
                    queue: runtime.infrastructure.queue,
                    max_batch_size: 10,
                    max_batch_timeout: 5,
                    max_retries: 3,
                },
            ])
            expect(config.triggers.crons).toEqual(['0 22 * * *'])
            expect(config.compatibility_date).toBe('2026-05-26')
            expect(config.compatibility_flags).toEqual([
                'no_handle_cross_request_promise_resolution',
                'nodejs_compat',
            ])
            expect(config.preview_urls).toBe(false)
            expect(config.secrets.required).toContain('NUXT_BETTER_AUTH_SECRET')
            expect(config.vars).not.toHaveProperty('NUXT_BETTER_AUTH_SECRET')
            expect(getBuildEnvironment({ STAGE: stage }, false)).toMatchObject({
                siteUrl: runtime.siteUrl,
                twitterAuthEnabled: true,
                emailPasswordAuthEnabled: false,
            })
        },
    )

    it('keeps retained development resources separate from production', () => {
        const development = getCloudflareConfig('development')
        const production = getCloudflareConfig('production')
        expect(development.d1_databases[0]?.database_id).toBe(
            '1ecd2ac8-1fbf-451b-a985-0f5647654f6d',
        )
        expect(production.d1_databases[0]?.database_id).toBe('3e7627f7-08e9-4875-875d-073c9ff0815e')
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
    })

    it('fails closed on unknown stages, retired previews and mismatched build URLs', () => {
        expect(() => getCloudflareConfig('preview')).toThrow('Stage')
        expect(() => getBuildEnvironment({ STAGE: 'staging' }, false)).toThrow('Stage')
        expect(() =>
            getBuildEnvironment({ STAGE: 'development', PREVIEW_NAME: 'development' }, false),
        ).toThrow()
        expect(() =>
            getBuildEnvironment(
                { STAGE: 'development', PUBLIC_SITE_URL: 'https://avatio.me' },
                false,
            ),
        ).toThrow()
        expect(() =>
            getBuildEnvironment(
                { STAGE: 'production', R2_PUBLIC_BASE_URL: 'https://images-dev.avatio.me' },
                false,
            ),
        ).toThrow()
        expect(getBuildEnvironment({}, true)).toMatchObject({
            siteUrl: 'http://localhost:3000',
            emailPasswordAuthEnabled: true,
        })
    })
})
