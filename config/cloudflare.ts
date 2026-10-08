import { bindings, triggers, type ConfigContext, type WorkerConfig } from 'cf/config'
import { z } from 'zod'

import { requireHttpsOrigin } from './build.ts'
import { getStageConfig, parseAvatioStage, type AvatioStage } from './environment.ts'
import { secretDefinitions } from './secrets.ts'

const id = z.string().regex(/^[a-f0-9]{32}$/)
const origin = z.string().refine((value) => {
    try {
        return requireHttpsOrigin(value, 'Resource URL') === value
    } catch {
        return false
    }
}, 'Expected an HTTPS origin')
const namespace = z.number().int().positive().max(4_294_967_295)
const databaseSchema = z.strictObject({ id: z.uuid().toLowerCase(), name: z.string().min(1) })
const resourceSchema = z.strictObject({
    database: databaseSchema,
    cache: z.strictObject({ id, name: z.string().min(1) }),
    bucket: z.string().min(1),
    flagshipId: z.string().min(1),
    rateLimitNamespaces: z.tuple([namespace, namespace, namespace, namespace]),
    siteUrl: origin,
    imageBaseUrl: origin,
    emailFrom: z.email().optional(),
    analyticsSiteTag: z.string().min(1).optional(),
    optionalSecrets: z.array(z.enum(secretDefinitions.map(({ key }) => key))).default([]),
})

// An operator-reviewed input, not a state store or a resource provisioning mechanism.
const inventorySchema = z.strictObject({
    accountId: id,
    production: resourceSchema,
    development: resourceSchema,
})

export type CloudflareResourceInventory = z.input<typeof inventorySchema>

export const createCloudflareConfig = (context: ConfigContext, input: unknown) => {
    const { mode, isPreview } = context
    if (!mode) throw new Error('An explicit Cloudflare mode is required.')
    const stage = parseAvatioStage(mode)
    if (isPreview !== (stage === 'development'))
        throw new Error('Cloudflare mode and isPreview do not match.')

    const inventory = inventorySchema.parse(input)
    validateExistingCloudflareResources(inventory)
    return createCloudflareWorkerConfiguration(
        stage,
        isPreview,
        inventory.accountId,
        inventory[stage],
    )
}

const createCloudflareWorkerConfiguration = (
    stage: AvatioStage,
    isPreview: boolean,
    accountId: string,
    resources: z.output<typeof resourceSchema>,
) => {
    const config = getStageConfig(stage)
    const workerEnv: NonNullable<WorkerConfig['env']> = {
        ASSETS: bindings.assets(),
        APP_DB: bindings.d1(resources.database),
        CONTENT_CACHE: bindings.kv({ id: resources.cache.id }),
        R2: bindings.r2({ name: resources.bucket }),
        SELF_URL: bindings.text(resources.siteUrl),
        FLAGS: bindings.flagship({ id: resources.flagshipId }),
        AI: bindings.ai(),
        IMAGES: bindings.images(),
        PUBLIC_SITE_URL: bindings.text(resources.siteUrl),
        R2_PUBLIC_BASE_URL: bindings.text(resources.imageBaseUrl),
        STAGE: bindings.text(stage),
        AI_MODEL_CATALOG_ENRICHMENT: bindings.text(config.aiModels.catalogEnrichment),
        AI_MODEL_CATALOG_CLASSIFICATION: bindings.text(config.aiModels.catalogClassification),
        AI_MODEL_CHANGELOG_TRANSLATION: bindings.text(config.aiModels.changelogTranslation),
        AI_MODEL_CHANGELOG_SLUG: bindings.text(config.aiModels.changelogSlug),
        AUTH_TRUSTED_ORIGINS: bindings.text(
            JSON.stringify(isPreview ? [resources.siteUrl] : config.trustedOrigins),
        ),
    }
    const limits = [
        ['RATE_LIMIT_USER_ACTION', 5],
        ['RATE_LIMIT_IMAGE', 30],
        ['RATE_LIMIT_DRAFT', 120],
        ['RATE_LIMIT_ITEM_RESOLUTION', 32],
    ] as const
    for (const [index, [name, limit]] of limits.entries())
        workerEnv[name] = bindings.rateLimit({
            namespace: String(resources.rateLimitNamespaces[index]),
            simple: { limit, period: 60 },
        })
    for (const secret of secretDefinitions) {
        if (isPreview && secret.key === 'OG_IMAGE_SECRET') continue
        if (secret.required || resources.optionalSecrets.includes(secret.key))
            workerEnv[secret.key] = bindings.secret()
    }
    workerEnv.TWITTER_CLIENT_ID = bindings.text(config.twitterClientId)
    if (isPreview) {
        workerEnv.PREVIEW_NAME = bindings.text('development')
    } else {
        workerEnv.EMAIL = bindings.sendEmail({
            allowedSenderAddresses: [resources.emailFrom!],
        })
        workerEnv.EMAIL_FROM = bindings.text(resources.emailFrom!)
        workerEnv.ITEM_REVALIDATION_QUEUE = bindings.queue({ name: config.infrastructure.queue })
        workerEnv.CLOUDFLARE_ANALYTICS_ACCOUNT_ID = bindings.text(accountId)
        workerEnv.CLOUDFLARE_ANALYTICS_SITE_TAG = bindings.text(resources.analyticsSiteTag!)
        workerEnv.CLOUDFLARE_ANALYTICS_HOST = bindings.text(new URL(resources.siteUrl).hostname)
    }
    return {
        accountId: accountId,
        worker: {
            name: 'avatio',
            entrypoint: '.output/server/index.mjs',
            assets: { runWorkerFirst: true },
            compatibilityDate: '2026-05-26',
            compatibilityFlags: ['no_handle_cross_request_promise_resolution', 'nodejs_compat'],
            workersDev: true,
            previewUrls: true,
            domains: isPreview ? [] : [new URL(resources.siteUrl).hostname],
            cache: { enabled: true },
            observability: {
                enabled: true,
                headSamplingRate: 1,
                logs: { enabled: true, invocationLogs: true, headSamplingRate: 1, persist: true },
                traces: { enabled: false },
            },
            triggers: isPreview
                ? []
                : [
                      triggers.scheduled({ schedule: '0 22 * * *' }),
                      triggers.queue({
                          name: config.infrastructure.queue,
                          maxBatchSize: 10,
                          maxBatchTimeout: 5,
                          maxRetries: 3,
                      }),
                  ],
            env: workerEnv,
        } satisfies WorkerConfig,
    }
}

/** Reviewed existing targets only; configuration never provisions resources. */
export const getCloudflareTargetResources = (mode: string, input: unknown) => {
    const stage = parseAvatioStage(mode)
    const inventory = inventorySchema.parse(input)
    validateExistingCloudflareResources(inventory)
    return inventory[stage]
}

const validateExistingCloudflareResources = (inventory: z.output<typeof inventorySchema>) => {
    const permanent = [
        ['production', inventory.production],
        ['development', inventory.development],
    ] as const
    for (const [name, resources] of permanent) {
        const expected = getStageConfig(name)
        if (
            resources.database.name !== expected.infrastructure.appDatabase ||
            resources.cache.name !== expected.infrastructure.cache ||
            resources.bucket !== expected.infrastructure.bucket ||
            resources.imageBaseUrl !== expected.imageBaseUrl ||
            resources.rateLimitNamespaces.some(
                (value, index) => value !== expected.infrastructure.rateLimitNamespaces[index],
            ) ||
            (name === 'production' &&
                (resources.siteUrl !== expected.siteUrl ||
                    resources.emailFrom !== expected.emailFrom ||
                    !resources.analyticsSiteTag))
        )
            throw new Error(
                `Existing ${name} resource identity does not match stage configuration.`,
            )
    }

    const prod = inventory.production,
        dev = inventory.development
    if (
        dev.database.id === prod.database.id ||
        dev.database.name === prod.database.name ||
        dev.cache.id === prod.cache.id ||
        dev.cache.name === prod.cache.name ||
        dev.bucket === prod.bucket ||
        dev.imageBaseUrl === prod.imageBaseUrl ||
        dev.siteUrl === prod.siteUrl ||
        dev.flagshipId === prod.flagshipId ||
        dev.rateLimitNamespaces.some((value) => prod.rateLimitNamespaces.includes(value))
    )
        throw new Error('Development Preview must not use production resources or integrations.')
    if (dev.emailFrom !== undefined || dev.analyticsSiteTag || dev.optionalSecrets.length)
        throw new Error(
            'Development Preview email, analytics and optional credentials are disabled.',
        )
}

/** Read-only metadata for the persistent development Preview. */
export const getCloudflareDevelopmentInspectionConfiguration = (input: unknown) => {
    const inventory = inventorySchema.parse(input)
    validateExistingCloudflareResources(inventory)
    return {
        resources: inventory.development,
        configuration: createCloudflareWorkerConfiguration(
            'development',
            true,
            inventory.accountId,
            inventory.development,
        ),
    }
}
