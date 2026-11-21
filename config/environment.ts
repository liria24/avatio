import { z } from 'zod'

const avatioStages = ['development', 'production'] as const
export type AvatioStage = (typeof avatioStages)[number]

const aiTaskConfigSchema = z.object({
    catalogEnrichment: z.string().min(1),
    catalogClassification: z.string().min(1),
    changelogTranslation: z.string().min(1),
    changelogSlug: z.string().min(1),
})

const avatioStageConfigSchema = z.object({
    production: z.boolean(),
    siteUrl: z.url(),
    imageBaseUrl: z.url(),
    emailFrom: z.email(),
    emailSubjectPrefix: z.string(),
    emailAllowedRecipients: z.array(z.email()).optional(),
    features: z.object({
        cleanup: z.boolean(),
        discord: z.boolean(),
        analytics: z.boolean(),
        searchConsole: z.boolean(),
    }),
    twitterClientId: z.string().min(1),
    trustedOrigins: z.url().array(),
    aiModels: aiTaskConfigSchema,
    content: z.object({
        repo: z.string().min(1),
        branch: z.string().min(1),
        path: z.string().min(1),
    }),
    infrastructure: z.object({
        appDatabase: z.string().min(1),
        cache: z.string().min(1),
        bucket: z.string().min(1),
        queue: z.string().min(1),
        rateLimitNamespaces: z.tuple([
            z.number().int(),
            z.number().int(),
            z.number().int(),
            z.number().int(),
        ]),
    }),
})

export type AvatioStageConfig = z.infer<typeof avatioStageConfigSchema>

const common = {
    emailFrom: 'hello@avatio.me',
    twitterClientId: 'QUFuRTNOVjk3MXdxQjU1cnhGdks6MTpjaQ',
    aiModels: {
        catalogEnrichment: 'openai/gpt-5.6-luna',
        catalogClassification: 'typesafe/jev',
        changelogTranslation: 'openai/gpt-5.6-luna',
        changelogSlug: 'openai/gpt-5.6-luna',
    },
} as const

const stageConfig = {
    production: {
        ...common,
        production: true,
        emailSubjectPrefix: '',
        features: { cleanup: true, discord: true, analytics: true, searchConsole: true },
        siteUrl: 'https://avatio.me',
        imageBaseUrl: 'https://images.avatio.me',
        trustedOrigins: ['https://avatio.me'],
        content: { repo: 'liria24/avatio', branch: 'main', path: 'content' },
        infrastructure: {
            appDatabase: 'avatio',
            cache: 'avatio',
            bucket: 'avatio',
            queue: 'item-revalidation',
            rateLimitNamespaces: [2101, 2102, 2103, 2104],
        },
    },
    development: {
        ...common,
        production: false,
        emailSubjectPrefix: '[development] ',
        emailAllowedRecipients: ['hello@liria.me'],
        features: { cleanup: false, discord: false, analytics: false, searchConsole: false },
        siteUrl: 'https://dev.avatio.me',
        imageBaseUrl: 'https://images-dev.avatio.me',
        trustedOrigins: ['https://dev.avatio.me'],
        content: { repo: 'liria24/avatio', branch: 'development', path: 'content' },
        infrastructure: {
            appDatabase: 'avatio-development',
            cache: 'avatio-cache-development',
            bucket: 'avatio-development',
            queue: 'item-revalidation-development',
            rateLimitNamespaces: [2201, 2202, 2203, 2204],
        },
    },
} satisfies Record<AvatioStage, AvatioStageConfig>

export const parseAvatioStage = (value: string): AvatioStage => {
    const result = z.enum(avatioStages).safeParse(value)
    if (!result.success)
        throw new Error('Stage must be explicitly set to development or production.')
    return result.data
}

export const getStageConfig = (stage: string): AvatioStageConfig =>
    avatioStageConfigSchema.parse(stageConfig[parseAvatioStage(stage)])

export const getContentCachePrefix = (stage: AvatioStage) => {
    const { repo, branch } = getStageConfig(stage).content
    // Retain development's Preview-era keys when the same KV moves to a Worker.
    return `authored-content:v1:${repo}:${branch}${stage === 'development' ? ':preview:development' : ''}`
}
