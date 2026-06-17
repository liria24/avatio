import { serverError } from './error'
import { getRuntimeEnv } from './runtimeEnv'

type RateLimitBindingName = 'RATE_LIMIT_USER_ACTION' | 'RATE_LIMIT_IMAGE' | 'RATE_LIMIT_DRAFT'

interface RateLimitBinding {
    limit(options: { key: string }): Promise<{ success: boolean }>
}

interface RateLimitOptions {
    binding: RateLimitBindingName
    key: string
}

const isProduction =
    process.env.NODE_ENV === 'production' || process.env.CLOUDFLARE_ENV === 'production'

const isRateLimitBinding = (binding: unknown): binding is RateLimitBinding =>
    typeof binding === 'object' &&
    binding !== null &&
    'limit' in binding &&
    typeof binding.limit === 'function'

export const enforceRateLimit = async ({ binding, key }: RateLimitOptions) => {
    const limiter = getRuntimeEnv()[binding]

    if (!isRateLimitBinding(limiter)) {
        if (isProduction)
            throw serverError.internalServerError({
                log: {
                    tag: 'rateLimit',
                    message: `Cloudflare Rate Limit binding ${binding} is unavailable.`,
                },
            })

        return
    }

    const { success } = await limiter.limit({ key })
    if (!success)
        throw serverError.tooManyRequests({
            responseMessage: 'Too many requests. Please try again later.',
        })
}
