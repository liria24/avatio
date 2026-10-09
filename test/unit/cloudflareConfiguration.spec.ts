import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import cloudflareConfig from '../../cloudflare.config'
import { getBuildEnvironment } from '../../config/build'
import {
    createCloudflareConfig,
    getCloudflareDevelopmentInspectionConfiguration,
    getCloudflareTargetResources,
} from '../../config/cloudflare'
import { secretDefinitions } from '../../config/secrets'
import { createCloudflareResourceFixture } from '../helpers/cloudflareResources'

describe('Cloudflare configuration', () => {
    it('requires a reviewed file and matching development build settings at the CLI entry point', async () => {
        const directory = await mkdtemp(join(tmpdir(), 'avatio-cf-config-'))
        const context = { mode: 'development', isPreview: true }
        try {
            vi.stubEnv('AVATIO_CF_RESOURCES_FILE', '')
            expect(() => cloudflareConfig(context)).toThrow('AVATIO_CF_RESOURCES_FILE')
            const input = createCloudflareResourceFixture()
            const path = join(directory, 'resources.json')
            await writeFile(path, JSON.stringify(input))
            vi.stubEnv('AVATIO_CF_RESOURCES_FILE', path)
            vi.stubEnv('STAGE', 'development')
            vi.stubEnv('PREVIEW_NAME', 'development')
            vi.stubEnv('PUBLIC_SITE_URL', input.development.siteUrl)
            vi.stubEnv('R2_PUBLIC_BASE_URL', input.development.imageBaseUrl)
            expect(cloudflareConfig(context)).toEqual(createCloudflareConfig(context, input))
            vi.stubEnv('R2_PUBLIC_BASE_URL', 'https://unreviewed-images.example.test')
            expect(() => cloudflareConfig(context)).toThrow('must match')
            vi.stubEnv('R2_PUBLIC_BASE_URL', input.development.imageBaseUrl)
            vi.stubEnv('PREVIEW_NAME', '')
            expect(() => cloudflareConfig(context)).toThrow('must match')
            vi.stubEnv('STAGE', '')
            expect(() => cloudflareConfig(context)).toThrow()
        } finally {
            vi.unstubAllEnvs()
            await rm(directory, { recursive: true, force: true })
        }
    })

    it('keeps the existing production Worker, capabilities, domain, and runtime triggers', () => {
        const input = createCloudflareResourceFixture()
        input.production.optionalSecrets = secretDefinitions
            .filter(({ required }) => !required)
            .map(({ key }) => key)
        const { worker } = createCloudflareConfig({ mode: 'production', isPreview: false }, input)
        expect(worker.name).toBe('avatio')
        expect(worker.compatibilityDate).toBe('2026-05-26')
        expect(worker.compatibilityFlags).toEqual([
            'no_handle_cross_request_promise_resolution',
            'nodejs_compat',
        ])
        expect(worker.domains).toEqual(['avatio.me'])
        expect(worker.triggers).toEqual([
            { type: 'scheduled', schedule: '0 22 * * *' },
            {
                type: 'queue',
                name: 'item-revalidation',
                maxBatchSize: 10,
                maxBatchTimeout: 5,
                maxRetries: 3,
            },
        ])
        expect(worker.env.APP_DB).toMatchObject({ type: 'd1', ...input.production.database })
        expect(worker.env.CONTENT_CACHE).toMatchObject({ id: input.production.cache.id })
        for (const { key } of secretDefinitions) expect(worker.env[key]).toEqual({ type: 'secret' })
        expect(Object.hasOwn(worker.env, 'BETTER_AUTH_SECRET')).toBe(false)
        expect(worker.env.PREVIEW_NAME).toBeUndefined()
        expect(
            Object.values(worker.env).filter((binding) => binding.type === 'rate-limit'),
        ).toHaveLength(4)
    })

    it('uses the persistent development Preview and omits production side effects', () => {
        const input = createCloudflareResourceFixture()
        const { worker } = createCloudflareConfig({ mode: 'development', isPreview: true }, input)
        expect(worker.name).toBe('avatio')
        expect(worker.compatibilityDate).toBe('2026-05-26')
        expect(worker.compatibilityFlags).toEqual([
            'no_handle_cross_request_promise_resolution',
            'nodejs_compat',
        ])
        expect(worker.triggers).toEqual([])
        expect(worker.domains).toEqual([])
        expect(worker.env.STAGE).toEqual({ type: 'text', value: 'development' })
        expect(worker.env.PREVIEW_NAME).toEqual({ type: 'text', value: 'development' })
        expect(worker.env.APP_DB).toMatchObject(input.development.database)
        expect(worker.env.CONTENT_CACHE).toMatchObject({ id: input.development.cache.id })
        expect(worker.env.R2).toMatchObject({ name: input.development.bucket })
        expect(worker.env.SELF_URL).toEqual({ type: 'text', value: input.development.siteUrl })
        expect(worker.env.AUTH_TRUSTED_ORIGINS).toEqual({
            type: 'text',
            value: JSON.stringify([input.development.siteUrl]),
        })
        expect(worker.env.NUXT_BETTER_AUTH_SECRET).toEqual({ type: 'secret' })
        expect(worker.env.TWITTER_CLIENT_ID).toMatchObject({ type: 'text' })
        expect(worker.env.TWITTER_CLIENT_SECRET).toEqual({ type: 'secret' })
        for (const key of [
            'ITEM_REVALIDATION_QUEUE',
            'EMAIL',
            'EMAIL_FROM',
            'OG_IMAGE_ENDPOINT',
            'OG_IMAGE_SECRET',
            'CLOUDFLARE_ANALYTICS_ACCOUNT_ID',
            'CLOUDFLARE_ANALYTICS_SITE_TAG',
            'CLOUDFLARE_ANALYTICS_HOST',
            'CLOUDFLARE_ANALYTICS_READ_TOKEN',
            'GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET',
            'LIRIA_DISCORD_ACCESS_TOKEN',
            'PREVIEW_STORAGE_ISOLATED',
        ])
            expect(worker.env[key]).toBeUndefined()
        expect(getCloudflareDevelopmentInspectionConfiguration(input)).toEqual({
            resources: getCloudflareTargetResources('development', input),
            configuration: { accountId: input.accountId, worker },
        })
    })

    it.each([
        { mode: undefined, isPreview: false },
        { mode: 'local', isPreview: true },
        { mode: 'production', isPreview: true },
        { mode: 'development', isPreview: false },
        { mode: 'pr-354', isPreview: true },
        { mode: 'pr-354', isPreview: false },
        { mode: 'pr-0', isPreview: true },
    ])('rejects missing, invalid, or mismatched targets %j', (context) => {
        const input = createCloudflareResourceFixture()
        expect(() => createCloudflareConfig(context, input)).toThrow()
        if (context.mode !== 'production' && context.mode !== 'development')
            expect(() => getCloudflareTargetResources(context.mode ?? '', input)).toThrow()
    })

    it.each(['sharedPreviewStorage', 'previews', 'pr-354'])(
        'rejects obsolete inventory key %s for configuration and inspection',
        (key) => {
            const input = { ...createCloudflareResourceFixture(), [key]: {} }
            expect(() =>
                createCloudflareConfig({ mode: 'development', isPreview: true }, input),
            ).toThrow()
            expect(() => getCloudflareTargetResources('development', input)).toThrow()
            expect(() => getCloudflareDevelopmentInspectionConfiguration(input)).toThrow()
        },
    )

    it('rejects missing IDs, production resource reuse, changed identities, and disabled development integrations', () => {
        const mutate = (
            fn: (input: ReturnType<typeof createCloudflareResourceFixture>) => void,
        ) => {
            const input = createCloudflareResourceFixture()
            fn(input)
            expect(() =>
                createCloudflareConfig({ mode: 'development', isPreview: true }, input),
            ).toThrow()
            expect(() => getCloudflareDevelopmentInspectionConfiguration(input)).toThrow()
        }
        mutate((input) => {
            input.production.database.id = ''
        })
        mutate((input) => {
            input.development.database.id = input.production.database.id
        })
        mutate((input) => {
            input.production.database.id = 'abcdefab-cdef-4abc-8def-abcdefabcdef'
            input.development.database.id = input.production.database.id.toUpperCase()
        })
        mutate((input) => {
            input.development.database.name = 'unreviewed-development'
        })
        mutate((input) => {
            input.development.cache.id = input.production.cache.id
        })
        mutate((input) => {
            input.development.bucket = input.production.bucket
        })
        mutate((input) => {
            input.development.siteUrl = input.production.siteUrl
        })
        mutate((input) => {
            input.development.flagshipId = input.production.flagshipId
        })
        mutate((input) => {
            input.development.rateLimitNamespaces[0] = 2101
        })
        mutate((input) => {
            input.development.imageBaseUrl = 'https://unreviewed.example.test'
        })
        mutate((input) => {
            input.development.emailFrom = 'tester@example.test'
        })
        mutate((input) => {
            input.development.analyticsSiteTag = 'test-site'
        })
        mutate((input) => {
            input.development.optionalSecrets = ['CLOUDFLARE_ANALYTICS_READ_TOKEN']
        })
        mutate((input) => {
            Object.assign(input.development, { ogImageEndpoint: 'https://og.example.test' })
        })
        mutate((input) => {
            Object.assign(input.development, { emailDestinations: ['tester@example.test'] })
        })
    })
})

describe('Nuxt public build settings', () => {
    it('resolves stage settings without OAuth or signing secrets and keeps email/password local-only', () => {
        expect(getBuildEnvironment({ STAGE: 'production' }, false)).toMatchObject({
            siteUrl: 'https://avatio.me',
            imageBaseUrl: 'https://images.avatio.me',
            twitterAuthEnabled: true,
            emailPasswordAuthEnabled: false,
        })
        expect(getBuildEnvironment({ STAGE: 'development' }, false)).toMatchObject({
            siteUrl: 'https://dev.avatio.me',
            emailPasswordAuthEnabled: false,
        })
        expect(getBuildEnvironment({}, true)).toMatchObject({
            siteUrl: 'http://localhost:3000',
            emailPasswordAuthEnabled: true,
        })
        expect(() => getBuildEnvironment({ STAGE: 'staging' }, false)).toThrow()
    })

    it('requires explicit development Preview URLs and never infers Preview identity from a host', () => {
        const env = {
            STAGE: 'development',
            PREVIEW_NAME: 'development',
            PUBLIC_SITE_URL: 'https://development.example.test',
            R2_PUBLIC_BASE_URL: 'https://images.example.test',
        }
        expect(getBuildEnvironment(env, false)).toMatchObject({
            previewKind: 'development',
            dynamicOgImageEnabled: false,
            emailPasswordAuthEnabled: false,
            twitterAuthEnabled: true,
        })
        expect(() => getBuildEnvironment({ ...env, PREVIEW_NAME: 'pr-354' }, false)).toThrow()
        expect(() => getBuildEnvironment({ ...env, STAGE: 'production' }, false)).toThrow()
        expect(() => getBuildEnvironment({ ...env, PUBLIC_SITE_URL: undefined }, false)).toThrow()
        expect(() =>
            getBuildEnvironment({ ...env, R2_PUBLIC_BASE_URL: undefined }, false),
        ).toThrow()
        expect(() =>
            getBuildEnvironment({ ...env, PUBLIC_SITE_URL: 'https://avatio.me' }, false),
        ).toThrow()
        expect(() =>
            getBuildEnvironment({ ...env, R2_PUBLIC_BASE_URL: 'https://images.avatio.me' }, false),
        ).toThrow()
        expect(() =>
            getBuildEnvironment(
                { ...env, PUBLIC_SITE_URL: 'https://user:password@example.test' },
                false,
            ),
        ).toThrow()
        expect(
            getBuildEnvironment({ PUBLIC_SITE_URL: env.PUBLIC_SITE_URL }, false)
                .emailPasswordAuthEnabled,
        ).toBe(false)
    })
})
