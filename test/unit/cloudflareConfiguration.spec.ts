import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import cloudflareConfig from '../../cloudflare.config'
import { getBuildEnvironment } from '../../config/build'
import { createCloudflareConfig } from '../../config/cloudflare'
import { secretDefinitions } from '../../config/secrets'
import { createCloudflareResourceFixture } from '../helpers/cloudflareResources'

describe('prepared cf configuration', () => {
    it('requires a reviewed file and matching build settings at the CLI entry point', async () => {
        const directory = await mkdtemp(join(tmpdir(), 'avatio-cf-config-'))
        const context = { mode: 'pr-354', isPreview: true }
        try {
            vi.stubEnv('AVATIO_CF_RESOURCES_FILE', '')
            expect(() => cloudflareConfig(context)).toThrow('AVATIO_CF_RESOURCES_FILE')
            const input = createCloudflareResourceFixture()
            const resources = input.previews!['pr-354']!
            const path = join(directory, 'resources.json')
            await writeFile(path, JSON.stringify(input))
            vi.stubEnv('AVATIO_CF_RESOURCES_FILE', path)
            vi.stubEnv('STAGE', 'development')
            vi.stubEnv('PREVIEW_NAME', context.mode)
            vi.stubEnv('PUBLIC_SITE_URL', resources.siteUrl)
            vi.stubEnv('R2_PUBLIC_BASE_URL', resources.imageBaseUrl)
            vi.stubEnv('OG_IMAGE_ENDPOINT', resources.ogImageEndpoint)
            expect(cloudflareConfig(context)).toEqual(createCloudflareConfig(context, input))
            vi.stubEnv('R2_PUBLIC_BASE_URL', input.development.imageBaseUrl)
            expect(() => cloudflareConfig(context)).toThrow('must match')
            vi.stubEnv('STAGE', '')
            expect(() => cloudflareConfig(context)).toThrow()
        } finally {
            vi.unstubAllEnvs()
            await rm(directory, { recursive: true, force: true })
        }
    })

    it('keeps one Worker, all production capabilities, and existing runtime triggers', () => {
        const input = createCloudflareResourceFixture()
        input.production.optionalSecrets = secretDefinitions
            .filter(({ required }) => !required)
            .map(({ key }) => key)
        const { worker } = createCloudflareConfig({ mode: 'production', isPreview: false }, input)
        expect(worker.name).toBe('avatio')
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
        expect(worker.env.NUXT_BETTER_AUTH_SECRET).toEqual({ type: 'secret' })
        expect(
            Object.values(worker.env).filter((binding) => binding.type === 'rate-limit'),
        ).toHaveLength(4)
    })

    it.each(['development', 'pr-354', 'pr-355'])(
        'isolates %s and omits production side effects',
        (mode) => {
            const input = createCloudflareResourceFixture()
            const { worker } = createCloudflareConfig({ mode, isPreview: true }, input)
            expect(worker.name).toBe('avatio')
            expect(worker.triggers).toEqual([])
            expect(worker.domains).toEqual([])
            expect(worker.env.STAGE).toEqual({ type: 'text', value: 'development' })
            expect(worker.env.PREVIEW_NAME).toEqual({ type: 'text', value: mode })
            expect(worker.env.ITEM_REVALIDATION_QUEUE).toBeUndefined()
            expect(worker.env.CLOUDFLARE_ANALYTICS_READ_TOKEN).toBeUndefined()
            expect(worker.env.GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET).toBeUndefined()
            expect(worker.env.LIRIA_DISCORD_ACCESS_TOKEN).toBeUndefined()
            expect(worker.env.EMAIL).toMatchObject({
                allowedDestinationAddresses: ['tester@example.test'],
            })
            if (mode.startsWith('pr-')) {
                expect(worker.env.APP_DB).toMatchObject({ name: `avatio-${mode}` })
                expect(worker.env.R2).toMatchObject({ name: `avatio-${mode}` })
                expect(worker.env.TWITTER_CLIENT_ID).toBeUndefined()
                expect(worker.env.TWITTER_CLIENT_SECRET).toBeUndefined()
                expect(worker.env.AUTH_TRUSTED_ORIGINS).toEqual({
                    type: 'text',
                    value: JSON.stringify([`https://${mode}.previews.example.test`]),
                })
            }
            expect(createCloudflareConfig({ mode, isPreview: true }, input)).toEqual({
                accountId: input.accountId,
                worker,
            })
        },
    )

    it.each([
        { mode: undefined, isPreview: false },
        { mode: 'local', isPreview: true },
        { mode: 'production', isPreview: true },
        { mode: 'development', isPreview: false },
        { mode: 'pr-354', isPreview: false },
        { mode: 'pr-0', isPreview: true },
        { mode: 'pr-999', isPreview: true },
    ])('rejects missing, invalid, or mismatched targets %j', (context) => {
        expect(() => createCloudflareConfig(context, createCloudflareResourceFixture())).toThrow()
    })

    it('rejects absent IDs, cross-target resources, production credentials, and unrestricted email', () => {
        const mutate = (
            fn: (input: ReturnType<typeof createCloudflareResourceFixture>) => void,
        ) => {
            const input = createCloudflareResourceFixture()
            fn(input)
            expect(() =>
                createCloudflareConfig({ mode: 'pr-354', isPreview: true }, input),
            ).toThrow()
        }
        mutate((input) => {
            input.production.database.id = ''
        })
        mutate((input) => {
            input.previews!['pr-354']!.database.id = input.production.database.id
        })
        mutate((input) => {
            input.production.database.id = 'abcdefab-cdef-4abc-8def-abcdefabcdef'
            input.previews!['pr-354']!.database.id = input.production.database.id.toUpperCase()
        })
        mutate((input) => {
            input.previews!['pr-354']!.cache.id = input.development.cache.id
        })
        mutate((input) => {
            input.previews!['pr-354']!.bucket = input.production.bucket
        })
        mutate((input) => {
            input.previews!['pr-355']!.database.id = input.previews!['pr-354']!.database.id
        })
        mutate((input) => {
            input.previews!['pr-354']!.flagshipId = input.production.flagshipId
        })
        mutate((input) => {
            input.previews!['pr-354']!.rateLimitNamespaces[0] = 2101
        })
        mutate((input) => {
            input.previews!['pr-354']!.ogImageEndpoint = input.production.ogImageEndpoint
        })
        mutate((input) => {
            input.previews!['pr-354']!.optionalSecrets = ['CLOUDFLARE_ANALYTICS_READ_TOKEN']
        })
        mutate((input) => {
            input.previews!['pr-354']!.emailDestinations = []
        })
    })
})

describe('Nuxt public build settings', () => {
    it('resolves stage settings without OAuth or signing secrets', () => {
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

    it('requires explicit Preview URLs and never infers Preview from a host', () => {
        const env = {
            STAGE: 'development',
            PREVIEW_NAME: 'pr-354',
            PUBLIC_SITE_URL: 'https://pr-354.example.test',
            R2_PUBLIC_BASE_URL: 'https://images.example.test',
            OG_IMAGE_ENDPOINT: 'https://og.example.test',
        }
        expect(getBuildEnvironment(env, false)).toMatchObject({
            previewKind: 'pr',
            emailPasswordAuthEnabled: true,
            twitterAuthEnabled: false,
        })
        expect(() => getBuildEnvironment({ ...env, STAGE: 'production' }, false)).toThrow()
        expect(() => getBuildEnvironment({ ...env, PUBLIC_SITE_URL: undefined }, false)).toThrow()
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
