import {
    CloudflareCatalogSyncQueue,
    createCatalogItemClassifier,
    createWorkersAiCapabilities,
    SQLiteCatalogRepository,
    SQLitePublisherRepository,
} from '@avatio/cloudflare'
import {
    MissingServerServiceError,
    type AdminDiscordNotifier,
    type AiServiceBundle,
    type AvatioBackgroundScope,
    type AvatioExecutionScope,
    type AvatioRequestScope,
    type BackgroundTaskScheduler,
    type CacheInvalidator,
    type ConfiguredCatalogItemClassifier,
    type ExecutionScopeKind,
    type FeatureFlags,
    type FileStorage,
    type ModerationReportReader,
    type ViewerIdentity,
} from '@avatio/core'
import {
    CatalogProviderRegistry,
    itemCategories,
    syncCatalogSource,
    type CatalogSyncQueue,
} from '@avatio/core/catalog'
import { PublisherVerificationProviderRegistry } from '@avatio/core/publishers'
import {
    BoothCatalogProvider,
    GithubCatalogProvider,
} from '@avatio/nuxt/runtime/server/catalog/providers'
import { BoothPublisherVerificationProvider } from '@avatio/nuxt/runtime/server/publishers/providers'
import type { CacheContext, Queue } from '@cloudflare/workers-types'
import { createError, type H3Event } from '@nuxt/nitro-server/h3'

import type { AvatioStageConfig } from '../../config/environment'

export interface ServerRequestScope extends AvatioRequestScope {
    readonly db: AppDatabase
    readonly stageConfig: AvatioStageConfig
    readonly event: H3Event
}

export interface ServerBackgroundScope extends AvatioBackgroundScope {
    readonly db: AppDatabase
    readonly stageConfig: AvatioStageConfig
}

type ScopedH3Event = H3Event & {
    context: H3Event['context'] & {
        avatioScope?: ServerRequestScope
    }
}

const memo = <T>(factory: () => T): (() => T) => {
    let settled = false
    let cached: T
    return () => {
        if (!settled) {
            cached = factory()
            settled = true
        }
        return cached
    }
}

interface BaseScopeOptions {
    kind: ExecutionScopeKind
    event?: H3Event
    cache?: CacheContext
    db?: AppDatabase
    background: BackgroundTaskScheduler
}

const createBaseExecutionScope = (
    options: BaseScopeOptions,
): AvatioExecutionScope & {
    readonly db: AppDatabase
    readonly stageConfig: AvatioStageConfig
} => {
    const getDb = memo(() => options.db ?? useDB())
    const getStageConfigLazy = memo(() => getRuntimeStageConfig(options.event))
    const getFeatureFlagsLazy = memo((): FeatureFlags => getFeatureFlags(options.event))
    const getFileStorageLazy = memo((): FileStorage => getFileStorage())
    const getCacheInvalidatorLazy = memo((): CacheInvalidator =>
        options.event ? getCacheInvalidator(options.event) : createCacheInvalidator(options.cache),
    )
    const getCatalogRepositoryLazy = memo(() => {
        const db = getDb()
        return new SQLiteCatalogRepository(db, (queries) => executeAppBatch(db, queries))
    })
    const getPublisherRepositoryLazy = memo(() => {
        const db = getDb()
        return new SQLitePublisherRepository(db, (queries) => executeAppBatch(db, queries))
    })
    const getCatalogProviderRegistryLazy = memo(async () => {
        const proxyBaseUrl = getRuntimeEnvString('BOOTH_PROXY_URL', options.event)
        const publisherRepository = getPublisherRepositoryLazy()
        const resolvePublisherSource = async (
            snapshot: Parameters<typeof publisherRepository.upsertSource>[0],
        ) => (await publisherRepository.upsertSource(snapshot)).id

        return new CatalogProviderRegistry([
            new BoothCatalogProvider({
                proxyBaseUrl,
                categoryMap: BOOTH_CATEGORY_MAP,
                http: providerHttpClient,
                resolvePublisherSource,
            }),
            new GithubCatalogProvider({ http: providerHttpClient, resolvePublisherSource }),
        ])
    })
    const getPublisherVerificationProviderRegistryLazy = memo(() => {
        const proxyBaseUrl = getRuntimeEnvString('BOOTH_PROXY_URL', options.event)
        return new PublisherVerificationProviderRegistry([
            new BoothPublisherVerificationProvider({ proxyBaseUrl, http: providerHttpClient }),
        ])
    })
    const getCatalogSyncQueueLazy = memo((): CatalogSyncQueue | null => {
        if (import.meta.dev)
            return {
                async enqueue(message) {
                    await syncCatalogSource({
                        sourceId: message.sourceId,
                        leaseToken: message.leaseToken,
                        repository: getCatalogRepositoryLazy(),
                        providers: await getCatalogProviderRegistryLazy(),
                        cacheInvalidator: getCacheInvalidatorLazy(),
                    })
                },
            }
        const queue = getRuntimeEnv(options.event).ITEM_REVALIDATION_QUEUE as Queue | undefined
        return queue ? new CloudflareCatalogSyncQueue(queue) : null
    })
    const getAiCapabilitiesLazy = memo((): AiServiceBundle => {
        if (options.event) return useAiCapabilities(options.event)
        const binding = getRuntimeEnv().AI
        if (!binding)
            throw createError({
                statusCode: 503,
                message: new MissingServerServiceError('ai').message,
            })
        return createWorkersAiCapabilities({
            binding,
            models: getStageConfigLazy().aiModels,
        })
    })
    const getCatalogItemClassifierLazy = memo((): ConfiguredCatalogItemClassifier | null => {
        if (options.event) return getCatalogItemClassifier(options.event)
        const binding = getRuntimeEnv().AI
        if (!binding) return null
        const model = getStageConfigLazy().aiModels.catalogClassification
        return {
            classifier: createCatalogItemClassifier({ binding, model, itemCategories }),
            model,
        }
    })

    return {
        kind: options.kind,
        get stage() {
            return getStageConfigLazy().production ? 'production' : 'development'
        },
        isDev: import.meta.dev,
        background: options.background,
        get db() {
            return getDb()
        },
        get stageConfig() {
            return getStageConfigLazy()
        },
        getFeatureFlags: getFeatureFlagsLazy,
        getFileStorage: getFileStorageLazy,
        getCacheInvalidator: getCacheInvalidatorLazy,
        getCatalogRepository: getCatalogRepositoryLazy,
        getPublisherRepository: getPublisherRepositoryLazy,
        getCatalogProviderRegistry: getCatalogProviderRegistryLazy,
        getPublisherVerificationProviderRegistry: getPublisherVerificationProviderRegistryLazy,
        getCatalogSyncQueue: getCatalogSyncQueueLazy,
        getAiCapabilities: getAiCapabilitiesLazy,
        getCatalogItemClassifier: getCatalogItemClassifierLazy,
    }
}

export const createRequestScope = (
    event: H3Event,
    viewer: ViewerIdentity | null = null,
): ServerRequestScope => {
    const background: BackgroundTaskScheduler = {
        schedule: (task) => {
            if (typeof event.waitUntil === 'function') {
                event.waitUntil(task)
                return
            }
            void task.catch((error) => {
                logger('waitUntil').error('Background task failed:', error)
            })
        },
    }
    const base = createBaseExecutionScope({
        kind: 'request',
        event,
        background,
    })
    const scope: ServerRequestScope = {
        get kind() {
            return 'request' as const
        },
        get stage() {
            return base.stage
        },
        isDev: base.isDev,
        background: base.background,
        viewer,
        event,
        get db() {
            return base.db
        },
        get stageConfig() {
            return base.stageConfig
        },
        getFeatureFlags: base.getFeatureFlags,
        getFileStorage: base.getFileStorage,
        getCacheInvalidator: base.getCacheInvalidator,
        getCatalogRepository: base.getCatalogRepository,
        getPublisherRepository: base.getPublisherRepository,
        getCatalogProviderRegistry: base.getCatalogProviderRegistry,
        getPublisherVerificationProviderRegistry: base.getPublisherVerificationProviderRegistry,
        getCatalogSyncQueue: base.getCatalogSyncQueue,
        getAiCapabilities: base.getAiCapabilities,
        getCatalogItemClassifier: base.getCatalogItemClassifier,
    }

    if (event.context) (event as ScopedH3Event).context.avatioScope = scope
    return scope
}

export const getRequestScope = (event: H3Event): ServerRequestScope | null =>
    (event as ScopedH3Event).context?.avatioScope ?? null

export const requireRequestScope = (event: H3Event): ServerRequestScope => {
    const scope = getRequestScope(event)
    if (!scope)
        throw createError({
            statusCode: 500,
            statusMessage: 'Internal Server Error',
            message: new MissingServerServiceError('requestScope').message,
        })
    return scope
}

export const createBackgroundScope = (
    kind: 'queue' | 'email' | 'task',
    options?: { cache?: CacheContext; db?: AppDatabase },
): ServerBackgroundScope => {
    const background: BackgroundTaskScheduler = {
        schedule: (task) => {
            void task.catch((error) => {
                logger('background').error('Background task failed:', error)
            })
        },
    }
    const base = createBaseExecutionScope({
        kind,
        cache: options?.cache,
        db: options?.db,
        background,
    })

    const discordNotifier: AdminDiscordNotifier = {
        async send(message) {
            if (import.meta.dev || !base.stageConfig.features.discord) return
            const endpoint = getRuntimeEnvString('LIRIA_DISCORD_ENDPOINT')?.replace(/\/+$/, '')
            const token = getRuntimeEnvString('LIRIA_DISCORD_ACCESS_TOKEN')
            if (!endpoint || !token) return
            await $fetch('/admin/message', {
                baseURL: endpoint,
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                body: message,
            })
        },
    }

    const moderationReports: ModerationReportReader = {
        async readPendingDigest({ from, to }) {
            const db = base.db
            const reportLog = logger('/api/admin/job/report')
            const [feedbacksData, setupReportsData, userReportsData] = await Promise.all([
                db.query.feedbacks
                    .findMany({
                        where: {
                            isClosed: { eq: false },
                            createdAt: { gte: from, lt: to },
                        },
                        orderBy: {
                            createdAt: 'desc',
                        },
                        columns: {
                            id: true,
                            createdAt: true,
                            fingerprint: true,
                            contextPath: true,
                            comment: true,
                        },
                    })
                    .catch((error) => {
                        reportLog.error('Failed to fetch feedback data:', error)
                        return null
                    }),
                db.query.setupReports
                    .findMany({
                        where: {
                            isResolved: { eq: false },
                            createdAt: { gte: from, lt: to },
                        },
                        orderBy: {
                            createdAt: 'desc',
                        },
                    })
                    .catch((error) => {
                        reportLog.error('Failed to fetch setup report data:', error)
                        return null
                    }),
                db.query.userReports
                    .findMany({
                        where: {
                            isResolved: { eq: false },
                            createdAt: { gte: from, lt: to },
                        },
                        orderBy: {
                            createdAt: 'desc',
                        },
                    })
                    .catch((error) => {
                        reportLog.error('Failed to fetch user report data:', error)
                        return null
                    }),
            ])

            return {
                feedbacks: {
                    data: feedbacksData,
                    error: feedbacksData === null,
                },
                setupReports: {
                    data: setupReportsData,
                    error: setupReportsData === null,
                },
                userReports: {
                    data: userReportsData,
                    error: userReportsData === null,
                },
            }
        },
    }

    return {
        kind,
        get stage() {
            return base.stage
        },
        isDev: base.isDev,
        background: base.background,
        discordNotifier,
        moderationReports,
        get db() {
            return base.db
        },
        get stageConfig() {
            return base.stageConfig
        },
        getFeatureFlags: base.getFeatureFlags,
        getFileStorage: base.getFileStorage,
        getCacheInvalidator: base.getCacheInvalidator,
        getCatalogRepository: base.getCatalogRepository,
        getPublisherRepository: base.getPublisherRepository,
        getCatalogProviderRegistry: base.getCatalogProviderRegistry,
        getPublisherVerificationProviderRegistry: base.getPublisherVerificationProviderRegistry,
        getCatalogSyncQueue: base.getCatalogSyncQueue,
        getAiCapabilities: base.getAiCapabilities,
        getCatalogItemClassifier: base.getCatalogItemClassifier,
    }
}
