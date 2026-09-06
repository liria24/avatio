import { z } from 'zod'

export const secretDefinitions = [
    {
        key: 'BETTER_AUTH_SECRET',
        required: true,
        purpose: 'Better Auth session and token signing',
    },
    {
        key: 'BOOTH_PROXY_URL',
        required: true,
        purpose: 'Authenticated BOOTH provider proxy',
    },
    {
        key: 'TWITTER_CLIENT_SECRET',
        required: true,
        purpose: 'Twitter OAuth client credential',
    },
    {
        key: 'OG_IMAGE_SECRET',
        required: true,
        purpose: 'OG image request authentication',
    },
    {
        key: 'LIRIA_DISCORD_ENDPOINT',
        required: false,
        purpose: 'Optional Discord integration endpoint',
    },
    {
        key: 'LIRIA_DISCORD_ACCESS_TOKEN',
        required: false,
        purpose: 'Optional Discord integration credential',
    },
    {
        key: 'CLOUDFLARE_ANALYTICS_READ_TOKEN',
        required: false,
        purpose: 'Optional Cloudflare Web Analytics read access',
    },
    {
        key: 'GOOGLE_SEARCH_CONSOLE_CLIENT_ID',
        required: false,
        purpose: 'Optional Google Search Console OAuth client ID',
    },
    {
        key: 'GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET',
        required: false,
        purpose: 'Optional Google Search Console OAuth client secret',
    },
    {
        key: 'GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN',
        required: false,
        purpose: 'Optional Google Search Console OAuth refresh token',
    },
] as const

export type AvatioSecretName = (typeof secretDefinitions)[number]['key']
export type SecretInput = Partial<Record<AvatioSecretName, string | undefined>>

const optionalNonEmpty = z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().min(1).optional(),
)

export const avatioSecretsSchema = z
    .object({
        BETTER_AUTH_SECRET: z.string().min(32, 'must contain at least 32 characters'),
        BOOTH_PROXY_URL: z.url('must be a valid URL'),
        TWITTER_CLIENT_SECRET: z.string().min(1, 'must not be empty'),
        OG_IMAGE_SECRET: z.string().min(16, 'must contain at least 16 characters'),
        LIRIA_DISCORD_ENDPOINT: optionalNonEmpty.pipe(z.url('must be a valid URL').optional()),
        LIRIA_DISCORD_ACCESS_TOKEN: optionalNonEmpty,
        CLOUDFLARE_ANALYTICS_READ_TOKEN: optionalNonEmpty,
        GOOGLE_SEARCH_CONSOLE_CLIENT_ID: optionalNonEmpty,
        GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET: optionalNonEmpty,
        GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN: optionalNonEmpty,
    })
    .superRefine((value, context) => {
        if (Boolean(value.LIRIA_DISCORD_ENDPOINT) === Boolean(value.LIRIA_DISCORD_ACCESS_TOKEN)) {
            return
        }
        context.addIssue({
            code: 'custom',
            path: [
                value.LIRIA_DISCORD_ENDPOINT
                    ? 'LIRIA_DISCORD_ACCESS_TOKEN'
                    : 'LIRIA_DISCORD_ENDPOINT',
            ],
            message: 'must be configured together with the Discord integration counterpart',
        })
    })

export type AvatioSecrets = z.infer<typeof avatioSecretsSchema>

export interface ConfigurationIssue {
    name: string
    reason: string
}

export const validateSecrets = (
    input: Record<string, string | undefined>,
): { success: true; value: AvatioSecrets } | { success: false; issues: ConfigurationIssue[] } => {
    const result = avatioSecretsSchema.safeParse(input)
    if (result.success) return { success: true, value: result.data }

    return {
        success: false,
        issues: result.error.issues.map((issue) => ({
            name: issue.path.join('.') || 'configuration',
            reason: issue.message,
        })),
    }
}
