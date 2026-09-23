import { z } from 'zod'

const avatioStages = ['development', 'production'] as const
export type AvatioStage = (typeof avatioStages)[number]

const aiTaskConfigSchema = z.object({
    catalogEnrichment: z.string().min(1),
    changelogTranslation: z.string().min(1),
    changelogSlug: z.string().min(1),
})

const avatioStageConfigSchema = z.object({
    production: z.boolean(),
    siteUrl: z.url(),
    imageBaseUrl: z.url(),
    emailFrom: z.email(),
    twitterClientId: z.string().min(1),
    trustedOrigins: z.url().array(),
    aiModels: aiTaskConfigSchema,
    content: z.object({
        repo: z.string().min(1),
        branch: z.string().min(1),
        path: z.string().min(1),
    }),
    infrastructure: z.object({
        worker: z.string().min(1),
        appDatabase: z.string().min(1),
        contentDatabase: z.string().min(1),
        cache: z.string().min(1),
        bucket: z.string().min(1),
        queue: z.string().min(1),
        flags: z.string().min(1),
        rateLimitNamespaces: z.tuple([z.number().int(), z.number().int(), z.number().int()]),
    }),
})

export type AvatioStageConfig = z.infer<typeof avatioStageConfigSchema>

const common = {
    emailFrom: 'hello@avatio.me',
    twitterClientId: 'QUFuRTNOVjk3MXdxQjU1cnhGdks6MTpjaQ',
    aiModels: {
        catalogEnrichment: 'openai/gpt-5.6-luna',
        changelogTranslation: 'openai/gpt-5.6-luna',
        changelogSlug: 'openai/gpt-5.6-luna',
    },
} as const

const stageConfig = {
    production: {
        ...common,
        production: true,
        siteUrl: 'https://avatio.me',
        imageBaseUrl: 'https://images.avatio.me',
        trustedOrigins: ['https://avatio.me'],
        content: { repo: 'liria24/avatio', branch: 'main', path: 'content' },
        infrastructure: {
            worker: 'avatio',
            appDatabase: 'avatio',
            contentDatabase: 'avatio-content',
            cache: 'avatio',
            bucket: 'avatio',
            queue: 'item-revalidation',
            flags: 'avatio-production',
            rateLimitNamespaces: [2101, 2102, 2103],
        },
    },
    development: {
        ...common,
        production: false,
        siteUrl: 'https://dev.avatio.me',
        imageBaseUrl: 'https://images-dev.avatio.me',
        trustedOrigins: ['http://localhost:3000', 'http://127.0.0.1:3000', 'https://dev.avatio.me'],
        content: { repo: 'liria24/avatio', branch: 'development', path: 'content' },
        infrastructure: {
            worker: 'avatio-development',
            appDatabase: 'avatio-development',
            contentDatabase: 'avatio-content-development',
            cache: 'avatio-cache-development',
            bucket: 'avatio-development',
            queue: 'item-revalidation-development',
            flags: 'avatio-development',
            rateLimitNamespaces: [2201, 2202, 2203],
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
