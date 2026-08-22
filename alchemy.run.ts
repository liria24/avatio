import * as Alchemy from 'alchemy'
import { Stage } from 'alchemy'
import * as Cloudflare from 'alchemy/Cloudflare'
import * as Config from 'effect/Config'
import * as Effect from 'effect/Effect'

type StageNames = {
    production: boolean
    worker: string
    appDatabase: string
    contentDatabase: string
    cache: string
    bucket: string
    queue: string
    site: string
    imageSite: string
    flags: string
    rateLimits: readonly [number, number, number]
}

const namesForStage = (stage: string): StageNames => {
    if (stage === 'production')
        return {
            production: true,
            worker: 'avatio',
            appDatabase: 'avatio',
            contentDatabase: 'avatio-content',
            cache: 'avatio-cache',
            bucket: 'avatio',
            queue: 'item-revalidation',
            site: 'avatio.me',
            imageSite: 'images.avatio.me',
            flags: 'avatio-production',
            rateLimits: [2101, 2102, 2103],
        }
    if (stage === 'development')
        return {
            production: false,
            worker: 'avatio-development',
            appDatabase: 'avatio-development',
            contentDatabase: 'avatio-content-development',
            cache: 'avatio-cache-development',
            bucket: 'avatio-development',
            queue: 'item-revalidation-development',
            site: 'dev.avatio.me',
            imageSite: 'images-dev.avatio.me',
            flags: 'avatio-development',
            rateLimits: [2201, 2202, 2203],
        }
    throw new Error('Alchemy stage must be development or production.')
}

const requiredSecret = (name: string) => Config.redacted(name)

const retainProduction = Alchemy.RemovalPolicy.retain(
    Effect.map(Stage, (stage) => stage === 'production'),
)

export const AppDatabase = Cloudflare.D1.Database(
    'AppDatabase',
    Effect.gen(function* () {
        const names = namesForStage(yield* Stage)
        return { name: names.appDatabase, migrations: './drizzle' }
    }),
).pipe(retainProduction)

export const ContentDatabase = Cloudflare.D1.Database(
    'ContentDatabase',
    Effect.gen(function* () {
        const names = namesForStage(yield* Stage)
        // Nuxt Content owns this database's schema. App migrations belong only
        // to APP_DB and must never be replayed against the content database.
        return { name: names.contentDatabase }
    }),
).pipe(retainProduction)

export const Cache = Cloudflare.KV.Namespace(
    'Cache',
    Effect.gen(function* () {
        const names = namesForStage(yield* Stage)
        return { title: names.cache }
    }),
).pipe(retainProduction)

export const Files = Cloudflare.R2.Bucket(
    'Files',
    Effect.gen(function* () {
        const names = namesForStage(yield* Stage)
        const domains = names.production
            ? [
                  {
                      name: names.imageSite,
                      enabled: true,
                      minTLS: '1.0' as const,
                  },
              ]
            : [{ name: names.imageSite }]
        return {
            name: names.bucket,
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
                    id: `${names.production ? 'production' : 'development'}-images`,
                    allowedOrigins: [
                        `https://${names.site}`,
                        `https://${names.imageSite}`,
                        ...(names.production ? [] : ['http://localhost:3000']),
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
        const names = namesForStage(yield* Stage)
        return { name: names.queue }
    }),
).pipe(retainProduction)

export const Flags = Cloudflare.Flagship.App(
    'Flags',
    Effect.gen(function* () {
        const names = namesForStage(yield* Stage)
        return { name: names.flags }
    }),
)

const rateLimit = (name: string, namespaceId: number, limit: number) =>
    Cloudflare.RateLimit(name, { namespaceId, simple: { limit, period: 60 } })

const makeWebsiteEnv = (names: StageNames) => ({
    APP_DB: AppDatabase,
    DB: ContentDatabase,
    KV: Cache,
    R2: Files,
    SELF_URL: Cloudflare.Workers.URL,
    ITEM_REVALIDATION_QUEUE: ItemRevalidationQueue,
    FLAGS: Flags,
    AI: Cloudflare.Workers.AI(),
    IMAGES: Cloudflare.Images.Images('IMAGES'),
    EMAIL: Cloudflare.Email.SendEmail('EMAIL', {
        allowedSenderAddresses: ['hello@avatio.me'],
    }),
    RATE_LIMIT_USER_ACTION: rateLimit('RATE_LIMIT_USER_ACTION', names.rateLimits[0], 5),
    RATE_LIMIT_IMAGE: rateLimit('RATE_LIMIT_IMAGE', names.rateLimits[1], 30),
    RATE_LIMIT_DRAFT: rateLimit('RATE_LIMIT_DRAFT', names.rateLimits[2], 120),
    PUBLIC_SITE_URL: `https://${names.site}`,
    R2_PUBLIC_BASE_URL: `https://${names.imageSite}`,
    STAGE: names.production ? 'production' : 'development',
    NUXT_BOOTH_PROXY_URL: requiredSecret('NUXT_BOOTH_PROXY_URL'),
    OG_IMAGE_SECRET: requiredSecret('OG_IMAGE_SECRET'),
    LIRIA_DISCORD_ENDPOINT: Config.redacted('LIRIA_DISCORD_ENDPOINT').pipe(Config.withDefault('')),
    LIRIA_DISCORD_ACCESS_TOKEN: requiredSecret('LIRIA_DISCORD_ACCESS_TOKEN'),
    EMAIL_FROM: 'hello@avatio.me',
    NUXT_EMAIL_FROM_ADDRESS: 'hello@avatio.me',
    BETTER_AUTH_SECRET: requiredSecret(
        names.production ? 'BETTER_AUTH_SECRET' : 'BETTER_AUTH_SECRET_DEVELOPMENT',
    ),
    TWITTER_CLIENT_ID: requiredSecret('TWITTER_CLIENT_ID'),
    TWITTER_CLIENT_SECRET: requiredSecret('TWITTER_CLIENT_SECRET'),
})

export const Website = Cloudflare.Website.Nuxt(
    'Website',
    Effect.gen(function* () {
        const names = namesForStage(yield* Stage)
        const siteUrl = `https://${names.site}`
        return {
            name: names.worker,
            domain: { name: names.site },
            workersDev: { enabled: true, previewsEnabled: true },
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
            crons: names.production ? ['0 22 * * *'] : [],
            env: makeWebsiteEnv(names),
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
                        names.imageSite,
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
        const names = namesForStage(currentStage)
        const website = yield* Website
        const queue = yield* ItemRevalidationQueue

        yield* Cloudflare.Queues.Consumer('ItemRevalidationConsumer', {
            queueId: queue.queueId,
            scriptName: website.workerName,
            settings: { batchSize: 10, maxWaitTimeMs: 5000, maxRetries: 3 },
        })

        if (names.production)
            yield* Cloudflare.Rum.Site('WebAnalytics', {
                zoneTag: 'dae79da2dd3dda74ec53220f91811a1d',
                autoInstall: true,
                enabled: true,
                lite: true,
            })

        return {
            stage: currentStage,
            url: website.url,
            worker: website.workerName,
            appDatabase: (yield* AppDatabase).databaseId,
            contentDatabase: (yield* ContentDatabase).databaseId,
            bucket: (yield* Files).bucketName,
            queue: queue.queueName,
        }
    }),
)
