import * as Alchemy from 'alchemy'
import { Stage } from 'alchemy'
import * as Cloudflare from 'alchemy/Cloudflare'
import * as Config from 'effect/Config'
import * as Effect from 'effect/Effect'

import { getStageConfig, type AvatioStageConfig } from './config/environment'
import type { AvatioSecretName } from './config/secrets'

const requiredSecret = (name: AvatioSecretName) => Config.redacted(name)
const optionalSecret = (name: AvatioSecretName) =>
    Config.redacted(name).pipe(Config.withDefault(''))

const retainProduction = Alchemy.RemovalPolicy.retain(
    Effect.map(Stage, (stage) => stage === 'production'),
)

export const AppDatabase = Cloudflare.D1.Database(
    'AppDatabase',
    Effect.gen(function* () {
        const config = getStageConfig(yield* Stage)
        return { name: config.infrastructure.appDatabase, migrations: './drizzle' }
    }),
).pipe(retainProduction)

export const ContentDatabase = Cloudflare.D1.Database(
    'ContentDatabase',
    Effect.gen(function* () {
        const config = getStageConfig(yield* Stage)
        // Retention placeholder only: Nuxt Content is no longer active and this
        // database is deliberately not bound to Website. Keep it until an
        // operator explicitly approves reuse or deletion.
        return { name: config.infrastructure.contentDatabase }
    }),
).pipe(retainProduction)

export const Cache = Cloudflare.KV.Namespace(
    'Cache',
    Effect.gen(function* () {
        const config = getStageConfig(yield* Stage)
        return { title: config.infrastructure.cache }
    }),
).pipe(retainProduction)

export const Files = Cloudflare.R2.Bucket(
    'Files',
    Effect.gen(function* () {
        const config = getStageConfig(yield* Stage)
        const imageHost = new URL(config.imageBaseUrl).hostname
        const domains = config.production
            ? [
                  {
                      name: imageHost,
                      enabled: true,
                      minTLS: '1.0' as const,
                  },
              ]
            : [{ name: imageHost }]
        return {
            name: config.infrastructure.bucket,
            forceDestroy: false,
            domains,
            lifecycleRules: [
                {
                    id: 'delete-backups-after-three-days',
                    prefix: 'backup/',
                    deleteObjectsTransition: {
                        condition: { type: 'Age' as const, maxAge: 3 * 24 * 60 * 60 },
                    },
                },
                {
                    id: 'abort-multipart-after-seven-days',
                    abortMultipartUploadsTransition: {
                        condition: { type: 'Age' as const, maxAge: 7 * 24 * 60 * 60 },
                    },
                },
            ],
            cors: [
                {
                    id: `${config.production ? 'production' : 'development'}-images`,
                    allowedOrigins: [
                        config.siteUrl,
                        config.imageBaseUrl,
                        ...(config.production ? [] : ['http://localhost:3000']),
                    ],
                    allowedMethods: ['GET', 'HEAD', 'PUT', 'POST'] as (
                        | 'GET'
                        | 'HEAD'
                        | 'PUT'
                        | 'POST'
                    )[],
                    allowedHeaders: ['content-type', 'range'],
                    exposeHeaders: ['etag', 'content-length', 'content-type'],
                    maxAgeSeconds: 3600,
                },
            ],
        }
    }),
).pipe(retainProduction)

export const ItemRevalidationQueue = Cloudflare.Queues.Queue(
    'ItemRevalidationQueue',
    Effect.gen(function* () {
        const config = getStageConfig(yield* Stage)
        return { name: config.infrastructure.queue }
    }),
).pipe(retainProduction)

export const Flags = Cloudflare.Flagship.App(
    'Flags',
    Effect.gen(function* () {
        const config = getStageConfig(yield* Stage)
        return { name: config.infrastructure.flags }
    }),
)

const rateLimit = (name: string, namespaceId: number, limit: number) =>
    Cloudflare.RateLimit(name, { namespaceId, simple: { limit, period: 60 } })

const makeWebsiteEnv = (config: AvatioStageConfig) => {
    const betterAuthSecret = requiredSecret('BETTER_AUTH_SECRET')
    const boothProxyUrl = requiredSecret('BOOTH_PROXY_URL')
    const rateLimits = config.infrastructure.rateLimitNamespaces

    return {
        APP_DB: AppDatabase,
        CONTENT_CACHE: Cache,
        R2: Files,
        SELF_URL: Cloudflare.Workers.URL,
        ITEM_REVALIDATION_QUEUE: ItemRevalidationQueue,
        FLAGS: Flags,
        AI: Cloudflare.Workers.AI(),
        IMAGES: Cloudflare.Images.Images('IMAGES'),
        EMAIL: Cloudflare.Email.SendEmail('EMAIL', {
            allowedSenderAddresses: [config.emailFrom],
        }),
        RATE_LIMIT_USER_ACTION: rateLimit('RATE_LIMIT_USER_ACTION', rateLimits[0], 5),
        RATE_LIMIT_IMAGE: rateLimit('RATE_LIMIT_IMAGE', rateLimits[1], 30),
        RATE_LIMIT_DRAFT: rateLimit('RATE_LIMIT_DRAFT', rateLimits[2], 120),
        PUBLIC_SITE_URL: config.siteUrl,
        R2_PUBLIC_BASE_URL: config.imageBaseUrl,
        STAGE: config.production ? 'production' : 'development',
        BOOTH_PROXY_URL: boothProxyUrl,
        OG_IMAGE_SECRET: requiredSecret('OG_IMAGE_SECRET'),
        LIRIA_DISCORD_ENDPOINT: optionalSecret('LIRIA_DISCORD_ENDPOINT'),
        LIRIA_DISCORD_ACCESS_TOKEN: optionalSecret('LIRIA_DISCORD_ACCESS_TOKEN'),
        CLOUDFLARE_ANALYTICS_READ_TOKEN: optionalSecret('CLOUDFLARE_ANALYTICS_READ_TOKEN'),
        GOOGLE_SEARCH_CONSOLE_CLIENT_ID: optionalSecret('GOOGLE_SEARCH_CONSOLE_CLIENT_ID'),
        GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET: optionalSecret('GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET'),
        GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN: optionalSecret('GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN'),
        EMAIL_FROM: config.emailFrom,
        BETTER_AUTH_SECRET: betterAuthSecret,
        NUXT_BETTER_AUTH_SECRET: betterAuthSecret,
        TWITTER_CLIENT_ID: config.twitterClientId,
        TWITTER_CLIENT_SECRET: requiredSecret('TWITTER_CLIENT_SECRET'),
        AI_MODEL_CATALOG_ENRICHMENT: config.aiModels.catalogEnrichment,
        AI_MODEL_CHANGELOG_TRANSLATION: config.aiModels.changelogTranslation,
        AI_MODEL_CHANGELOG_SLUG: config.aiModels.changelogSlug,
        AUTH_TRUSTED_ORIGINS: JSON.stringify(config.trustedOrigins),
    }
}

export const Website = Cloudflare.Website.Nuxt(
    'Website',
    Effect.gen(function* () {
        const config = getStageConfig(yield* Stage)
        const siteUrl = config.siteUrl
        const siteHost = new URL(config.siteUrl).hostname
        const imageHost = new URL(config.imageBaseUrl).hostname
        const webAnalytics = config.production
            ? yield* Cloudflare.Rum.Site('WebAnalytics', {
                  zoneTag: 'dae79da2dd3dda74ec53220f91811a1d',
                  autoInstall: true,
                  enabled: true,
                  lite: true,
              })
            : undefined
        return {
            name: config.infrastructure.worker,
            domain: { name: siteHost },
            workersDev: { enabled: true, previewsEnabled: true },
            dev: { port: 3000, strictPort: true },
            compatibility: {
                date: '2026-05-26',
                flags: [
                    'no_handle_cross_request_promise_resolution',
                    'nodejs_compat',
                    'no_nodejs_compat_v2',
                ],
            },
            cache: { enabled: true },
            observability: {
                enabled: true,
                headSamplingRate: 1,
                logs: { enabled: true, invocationLogs: true, headSamplingRate: 1, persist: true },
                traces: { enabled: false },
            },
            crons: config.production ? ['0 22 * * *'] : [],
            env: {
                ...makeWebsiteEnv(config),
                CLOUDFLARE_ANALYTICS_ACCOUNT_ID: webAnalytics?.accountId ?? '',
                CLOUDFLARE_ANALYTICS_SITE_TAG: webAnalytics?.siteTag ?? '',
                CLOUDFLARE_ANALYTICS_HOST: siteHost,
            },
            nuxt: {
                runtimeConfig: { public: { siteUrl } },
                appConfig: { app: { site: siteUrl } },
                site: { url: siteUrl },
                i18n: { baseUrl: siteUrl },
                socialShare: { baseUrl: siteUrl },
                app: {
                    head: {
                        meta: [
                            { property: 'og:site_name', content: 'Avatio' },
                            { property: 'og:type', content: 'website' },
                            { property: 'og:url', content: siteUrl },
                            { property: 'og:title', content: 'Avatio' },
                            { property: 'og:image', content: `${siteUrl}/ogp_2.png` },
                            {
                                name: 'description',
                                content: 'アバター改変レシピの共有プラットフォーム',
                            },
                            {
                                property: 'og:description',
                                content: 'アバター改変レシピの共有プラットフォーム',
                            },
                            { name: 'twitter:site', content: '@liria_24' },
                            { name: 'twitter:card', content: 'summary_large_image' },
                        ],
                    },
                },
                image: {
                    cloudflare: { baseURL: siteUrl },
                    domains: [
                        imageHost,
                        'booth.pximg.net',
                        's2.booth.pm',
                        'github.com',
                        'avatars.githubusercontent.com',
                    ],
                    provider: 'cloudflare',
                },
            },
        }
    }),
)

export type WebsiteEnv = Cloudflare.InferEnv<typeof Website>

export default Alchemy.Stack(
    'Avatio',
    {
        providers: Cloudflare.providers(),
        state: Cloudflare.state(),
    },
    Effect.gen(function* () {
        const currentStage = yield* Stage
        const website = yield* Website
        const queue = yield* ItemRevalidationQueue

        yield* Cloudflare.Queues.Consumer('ItemRevalidationConsumer', {
            queueId: queue.queueId,
            scriptName: website.workerName,
            settings: { batchSize: 10, maxWaitTimeMs: 5000, maxRetries: 3 },
        })

        return {
            stage: currentStage,
            url: website.url,
            worker: website.workerName,
            appDatabase: (yield* AppDatabase).databaseId,
            contentDatabase: (yield* ContentDatabase).databaseId,
            // Reuse the retained namespace for authored content, under its own key prefix.
            legacyCache: (yield* Cache).namespaceId,
            bucket: (yield* Files).bucketName,
            queue: queue.queueName,
        }
    }),
)
