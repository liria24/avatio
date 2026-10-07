import type { createWorkersAiCapabilities, FlagshipBinding } from '@avatio/cloudflare'
import type {
    D1Database,
    ImagesBinding,
    KVNamespace,
    Queue,
    R2Bucket,
    RateLimit,
    SendEmail,
} from '@cloudflare/workers-types'

import type { AvatioStage } from '../../config/environment'
import type { AvatioSecretName } from '../../config/secrets'

/** Application-facing bindings; deployment frameworks do not own the runtime type graph. */
export type AvatioWorkerEnv = Partial<Record<AvatioSecretName, string>> & {
    APP_DB: D1Database
    CONTENT_CACHE: KVNamespace
    R2: R2Bucket
    SELF_URL: string
    ITEM_REVALIDATION_QUEUE?: Queue
    FLAGS: FlagshipBinding
    AI: Parameters<typeof createWorkersAiCapabilities>[0]['binding']
    IMAGES: ImagesBinding
    EMAIL: SendEmail
    RATE_LIMIT_USER_ACTION: RateLimit
    RATE_LIMIT_IMAGE: RateLimit
    RATE_LIMIT_DRAFT: RateLimit
    RATE_LIMIT_ITEM_RESOLUTION: RateLimit
    PUBLIC_SITE_URL: string
    R2_PUBLIC_BASE_URL: string
    STAGE: AvatioStage
    PREVIEW_NAME?: string
    PREVIEW_STORAGE_ISOLATED?: string
    OG_IMAGE_ENDPOINT?: string
    EMAIL_FROM: string
    NUXT_BETTER_AUTH_SECRET: string
    TWITTER_CLIENT_ID?: string
    AI_MODEL_CATALOG_ENRICHMENT: string
    AI_MODEL_CATALOG_CLASSIFICATION: string
    AI_MODEL_CHANGELOG_TRANSLATION: string
    AI_MODEL_CHANGELOG_SLUG: string
    AUTH_TRUSTED_ORIGINS: string
    CLOUDFLARE_ANALYTICS_ACCOUNT_ID?: string
    CLOUDFLARE_ANALYTICS_SITE_TAG?: string
    CLOUDFLARE_ANALYTICS_HOST?: string
}
