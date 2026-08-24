import type { CacheInvalidationInput, CacheInvalidator } from '@avatio/core'
import type { CacheContext } from '@cloudflare/workers-types'

const resourceTags = (prefix: string, ids?: readonly string[]) =>
    ids?.map((id) => `${prefix}:${id}`) ?? []

export const toCloudflareCacheTags = (input: CacheInvalidationInput) => [
    ...resourceTags('item', input.items),
    ...resourceTags('setup', input.setups),
    ...resourceTags('user', input.users),
    ...(input.collections ?? []),
]

export class CloudflareCacheInvalidator implements CacheInvalidator {
    constructor(private readonly cache?: CacheContext) {}

    async invalidate(input: CacheInvalidationInput): Promise<void> {
        const tags = [...new Set(toCloudflareCacheTags(input))]
        if (!this.cache || !tags.length) return
        const result = await this.cache.purge({ tags })
        if (!result.success)
            throw new Error(
                `Cloudflare cache purge failed: ${result.errors
                    .map((error) => error.message)
                    .join(', ')}`,
            )
    }
}
