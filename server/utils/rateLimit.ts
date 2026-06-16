import { serverError } from './error'

interface RateLimitOptions {
    scope: string
    identity: string
    limit: number
    windowSeconds: number
}

interface RateLimitRecord {
    count: number
    resetAt: number
}

const RATE_LIMIT_STORAGE_TTL_PADDING_SECONDS = 60

const sha256Hex = async (value: string) => {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
    return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const getRateLimitKey = async (scope: string, identity: string, windowStart: number) =>
    `v1:${scope}:${await sha256Hex(identity)}:${windowStart}`

export const enforceRateLimit = async ({
    scope,
    identity,
    limit,
    windowSeconds,
}: RateLimitOptions) => {
    const now = Date.now()
    const windowMs = windowSeconds * 1000
    const windowStart = Math.floor(now / windowMs) * windowMs
    const resetAt = windowStart + windowMs
    const storage = useStorage('rate-limit')
    const key = await getRateLimitKey(scope, identity, windowStart)
    const current = await storage.getItem<RateLimitRecord>(key)
    const count = (current?.count ?? 0) + 1
    const remaining = Math.max(limit - count, 0)
    const event = useEvent()

    setResponseHeader(event, 'X-RateLimit-Limit', String(limit))
    setResponseHeader(event, 'X-RateLimit-Remaining', String(remaining))
    setResponseHeader(event, 'X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)))

    if (count > limit) {
        setResponseHeader(event, 'Retry-After', Math.ceil((resetAt - now) / 1000))
        throw serverError.tooManyRequests({
            responseMessage: 'Too many requests. Please try again later.',
        })
    }

    await storage.setItem(
        key,
        { count, resetAt } satisfies RateLimitRecord,
        { ttl: windowSeconds + RATE_LIMIT_STORAGE_TTL_PADDING_SECONDS },
    )
}
