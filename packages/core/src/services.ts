import type { CatalogProviderRegistry } from './catalog/application/provider-registry'
import type { CatalogRepository, CatalogSyncQueue } from './catalog/ports'
import type {
    CacheInvalidator,
    CatalogDisplayNameGenerator,
    CatalogItemClassifier,
    ChangelogSlugGenerator,
    ChangelogTranslator,
    FeatureFlags,
    FileStorage,
} from './ports'
import type { PublisherVerificationProviderRegistry } from './publishers/application/provider-registry'
import type { PublisherRepository } from './publishers/ports'
import type { ViewerIdentity } from './users'

export interface AiServiceBundle {
    catalogDisplayNameGenerator: CatalogDisplayNameGenerator
    changelogTranslator: ChangelogTranslator
    changelogSlugGenerator: ChangelogSlugGenerator
}

export interface ConfiguredCatalogItemClassifier {
    classifier: CatalogItemClassifier
    model: string
}

export interface BackgroundTaskScheduler {
    schedule(task: Promise<unknown>): void
}

export interface AdminDiscordNotifier {
    send(message: { content?: string; embeds?: object[] }): Promise<void>
}

export interface ModerationFeedbackDigestItem {
    id: number
    createdAt: Date
    fingerprint: string
    contextPath: string | null
    comment: string
}

export interface ModerationReportDigest {
    feedbacks: {
        data: ModerationFeedbackDigestItem[] | null
        error: boolean
    }
    setupReports: {
        data: unknown[] | null
        error: boolean
    }
    userReports: {
        data: unknown[] | null
        error: boolean
    }
}

export interface ModerationReportReader {
    readPendingDigest(window: { from: Date; to: Date }): Promise<ModerationReportDigest>
}

export type ExecutionScopeKind = 'request' | 'queue' | 'email' | 'task'

export interface AvatioExecutionScope {
    readonly kind: ExecutionScopeKind
    readonly stage: 'development' | 'production'
    readonly isDev: boolean
    readonly background: BackgroundTaskScheduler
    readonly getFeatureFlags: () => FeatureFlags
    readonly getFileStorage: () => FileStorage
    readonly getCacheInvalidator: () => CacheInvalidator
    readonly getCatalogRepository: () => CatalogRepository
    readonly getPublisherRepository: () => PublisherRepository
    readonly getCatalogProviderRegistry: () => Promise<CatalogProviderRegistry>
    readonly getPublisherVerificationProviderRegistry: () => PublisherVerificationProviderRegistry
    readonly getCatalogSyncQueue: () => CatalogSyncQueue | null
    readonly getAiCapabilities: () => AiServiceBundle
    readonly getCatalogItemClassifier: () => ConfiguredCatalogItemClassifier | null
}

export interface AvatioRequestScope extends AvatioExecutionScope {
    readonly kind: 'request'
    readonly viewer: ViewerIdentity | null
}

export interface AvatioBackgroundScope extends AvatioExecutionScope {
    readonly kind: 'queue' | 'email' | 'task'
    readonly discordNotifier: AdminDiscordNotifier
    readonly moderationReports: ModerationReportReader
}

export class MissingServerServiceError extends Error {
    readonly serviceName: string

    constructor(serviceName: string) {
        super(`Required server service "${serviceName}" is unavailable in this execution scope.`)
        this.name = 'MissingServerServiceError'
        this.serviceName = serviceName
    }
}

export const requireServerService = <T>(service: T | null | undefined, serviceName: string): T => {
    if (service === null || service === undefined) throw new MissingServerServiceError(serviceName)
    return service
}
