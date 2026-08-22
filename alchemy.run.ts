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

const optionalSecret = (name: string) => Config.redacted(name).pipe(Config.withDefault(''))

export const AppDatabase = Cloudflare.D1.Database(
    'AppDatabase',
    Effect.gen(function* () {
        const names = namesForStage(yield* Stage)
        return { name: names.appDatabase, migrations: './drizzle' }
    }),
)

export const ContentDatabase = Cloudflare.D1.Database(
    'ContentDatabase',
    Effect.gen(function* () {
        const names = namesForStage(yield* Stage)
        // Nuxt Content owns this database's schema. App migrations belong only
        // to APP_DB and must never be replayed against the content database.
        return { name: names.contentDatabase }
    }),
)

export const Cache = Cloudflare.KV.Namespace(
    'Cache',
    Effect.gen(function* () {
        const names = namesForStage(yield* Stage)
        return { title: names.cache }
    }),
)

export const Files = Cloudflare.R2.Bucket(
    'Files',
    Effect.gen(function* () {
        const names = namesForStage(yield* Stage)
        return {
            name: names.bucket,
            forceDestroy: false,
            domains: [{ name: names.imageSite }],
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
)

export const ItemRevalidationQueue = Cloudflare.Queues.Queue(
    'ItemRevalidationQueue',
    Effect.gen(function* () {
        const names = namesForStage(yield* Stage)
        return { name: names.queue }
    }),
)

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
    NUXT_BOOTH_PROXY_URL: optionalSecret('NUXT_BOOTH_PROXY_URL'),
    OG_IMAGE_SECRET: optionalSecret('OG_IMAGE_SECRET'),
    LIRIA_DISCORD_ENDPOINT: optionalSecret('LIRIA_DISCORD_ENDPOINT'),
    LIRIA_DISCORD_ACCESS_TOKEN: optionalSecret('LIRIA_DISCORD_ACCESS_TOKEN'),
    EMAIL_FROM: 'hello@avatio.me',
    NUXT_EMAIL_FROM_ADDRESS: 'hello@avatio.me',
    BETTER_AUTH_SECRET: optionalSecret(
        names.production ? 'BETTER_AUTH_SECRET' : 'BETTER_AUTH_SECRET_DEVELOPMENT',
    ),
    TWITTER_CLIENT_ID: optionalSecret('TWITTER_CLIENT_ID'),
    TWITTER_CLIENT_SECRET: optionalSecret('TWITTER_CLIENT_SECRET'),
})

export const Website = Cloudflare.Website.Nuxt(
    'Website',
    Effect.gen(function* () {
        const names = namesForStage(yield* Stage)
        return {
            name: names.worker,
            domain: { name: names.site },
            workersDev: { enabled: true, previewsEnabled: true },
            compatibility: {
                date: '2026-05-26',
                flags: ['no_handle_cross_request_promise_resolution'],
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
                host: names.site,
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
