import { bindings, triggers, type ConfigContext, type WorkerConfig } from 'cf/config'
import { z } from 'zod'

import { requireHttpsOrigin } from './build.ts'
import { getStageConfig } from './environment.ts'
import { getPreviewKind } from './preview.ts'
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
const resourceSchema = z.strictObject({
    database: z.strictObject({ id: z.uuid().toLowerCase(), name: z.string().min(1) }),
    cache: z.strictObject({ id, name: z.string().min(1) }),
    bucket: z.string().min(1),
    flagshipId: z.string().min(1),
    rateLimitNamespaces: z.tuple([namespace, namespace, namespace, namespace]),
    siteUrl: origin,
    imageBaseUrl: origin,
    ogImageEndpoint: origin,
    emailFrom: z.email(),
    emailDestinations: z.array(z.email()).default([]),
    analyticsSiteTag: z.string().min(1).optional(),
    optionalSecrets: z.array(z.enum(secretDefinitions.map(({ key }) => key))).default([]),
})

// An operator-reviewed input, not a state store or a resource provisioning mechanism.
const inventorySchema = z.strictObject({
    accountId: id,
    production: resourceSchema,
    development: resourceSchema,
    previews: z.record(z.string().regex(/^pr-[1-9]\d*$/), resourceSchema).default({}),
})

export type CloudflareResourceInventory = z.input<typeof inventorySchema>

export const createCloudflareConfig = (context: ConfigContext, input: unknown) => {
    const { mode, isPreview } = context
    if (!mode) throw new Error('An explicit Cloudflare mode is required.')
    const stage = mode === 'production' ? 'production' : 'development'
    const previewName = mode === 'production' ? undefined : mode
    const previewKind = getPreviewKind(stage, previewName)
    if (isPreview !== Boolean(previewKind))
        throw new Error('Cloudflare mode and isPreview do not match.')

    const inventory = inventorySchema.parse(input)
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
    const allResources = [...permanent, ...Object.entries(inventory.previews)]
    for (const [name, resources] of Object.entries(inventory.previews)) {
        const expectedName = `avatio-${name}`
        if (
            [resources.database.name, resources.cache.name, resources.bucket].some(
                (value) => value !== expectedName,
            )
        )
            throw new Error(`${name} requires dedicated resources named ${expectedName}.`)
    }
    for (const select of [
        (value: z.output<typeof resourceSchema>) => value.database.id,
        (value: z.output<typeof resourceSchema>) => value.cache.id,
        (value: z.output<typeof resourceSchema>) => value.bucket,
        (value: z.output<typeof resourceSchema>) => value.siteUrl,
        (value: z.output<typeof resourceSchema>) => value.imageBaseUrl,
    ]) {
        const values = allResources.map(([, value]) => select(value))
        if (new Set(values).size !== values.length)
            throw new Error('Production, development, and PR resources must be isolated.')
    }
    const namespaces = allResources.flatMap(([, value]) => value.rateLimitNamespaces)
    if (new Set(namespaces).size !== namespaces.length)
        throw new Error('Rate limit namespaces must be distinct across targets and bindings.')
    for (const [name, resources] of allResources) {
        if (name === 'production') continue
        if (
            resources.flagshipId === inventory.production.flagshipId ||
            resources.ogImageEndpoint === inventory.production.ogImageEndpoint ||
            resources.emailFrom === inventory.production.emailFrom ||
            resources.emailDestinations.length === 0 ||
            resources.analyticsSiteTag
        )
            throw new Error(
                `${name} requires non-production integrations and restricted email recipients.`,
            )
        if (resources.optionalSecrets.some((key) => key !== 'BOOTH_PROXY_URL'))
            throw new Error(
                'Preview operational analytics and notification credentials are not enabled.',
            )
    }

    const config = getStageConfig(stage)
    const resources = previewKind === 'pr' ? inventory.previews[mode] : inventory[stage]
    if (!resources) throw new Error(`No reviewed resource inventory for ${mode}.`)
    const workerEnv: NonNullable<WorkerConfig['env']> = {
        APP_DB: bindings.d1(resources.database),
        CONTENT_CACHE: bindings.kv({ id: resources.cache.id }),
        R2: bindings.r2({ name: resources.bucket }),
        SELF_URL: bindings.text(resources.siteUrl),
        FLAGS: bindings.flagship({ id: resources.flagshipId }),
        AI: bindings.ai(),
        IMAGES: bindings.images(),
        EMAIL: bindings.sendEmail(
            isPreview
                ? {
                      allowedSenderAddresses: [resources.emailFrom],
                      allowedDestinationAddresses: resources.emailDestinations,
                  }
                : { allowedSenderAddresses: [resources.emailFrom] },
        ),
        PUBLIC_SITE_URL: bindings.text(resources.siteUrl),
        R2_PUBLIC_BASE_URL: bindings.text(resources.imageBaseUrl),
        STAGE: bindings.text(stage),
        EMAIL_FROM: bindings.text(resources.emailFrom),
        AI_MODEL_CATALOG_ENRICHMENT: bindings.text(config.aiModels.catalogEnrichment),
        AI_MODEL_CATALOG_CLASSIFICATION: bindings.text(config.aiModels.catalogClassification),
        AI_MODEL_CHANGELOG_TRANSLATION: bindings.text(config.aiModels.changelogTranslation),
        AI_MODEL_CHANGELOG_SLUG: bindings.text(config.aiModels.changelogSlug),
        AUTH_TRUSTED_ORIGINS: bindings.text(
            JSON.stringify(isPreview ? [resources.siteUrl] : config.trustedOrigins),
        ),
        // The eventual publisher must derive this value from canonical BETTER_AUTH_SECRET.
        NUXT_BETTER_AUTH_SECRET: bindings.secret(),
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
        if (previewKind === 'pr' && secret.key === 'TWITTER_CLIENT_SECRET') continue
        if (secret.required || resources.optionalSecrets.includes(secret.key))
            workerEnv[secret.key] = bindings.secret()
    }
    if (previewKind !== 'pr') workerEnv.TWITTER_CLIENT_ID = bindings.text(config.twitterClientId)
    if (previewName) {
        workerEnv.PREVIEW_NAME = bindings.text(previewName)
        workerEnv.OG_IMAGE_ENDPOINT = bindings.text(resources.ogImageEndpoint)
    } else {
        workerEnv.ITEM_REVALIDATION_QUEUE = bindings.queue({ name: config.infrastructure.queue })
        workerEnv.CLOUDFLARE_ANALYTICS_ACCOUNT_ID = bindings.text(inventory.accountId)
        workerEnv.CLOUDFLARE_ANALYTICS_SITE_TAG = bindings.text(resources.analyticsSiteTag!)
        workerEnv.CLOUDFLARE_ANALYTICS_HOST = bindings.text(new URL(resources.siteUrl).hostname)
    }
    return {
        accountId: inventory.accountId,
        worker: {
            name: 'avatio',
            compatibilityDate: '2026-05-26',
            compatibilityFlags: [
                'no_handle_cross_request_promise_resolution',
                'nodejs_compat',
                'no_nodejs_compat_v2',
            ],
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
