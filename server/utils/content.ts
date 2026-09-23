import { createGithubContentSource } from '@avatio/nuxt/runtime/server/content/github'
import { createAvatioContentService } from '@avatio/nuxt/runtime/server/content/service'
import type { H3Event } from '@nuxt/nitro-server/h3'
import kvDriver from 'unstorage/drivers/cloudflare-kv-binding'
import { getStageConfig } from '~~/config/environment'

import { contentConfig } from '#avatio/content-config'

const log = logger('authoredContent')

export const getContentService = async (event: H3Event) => {
    if (import.meta.dev) {
        const { createLocalContentService } =
            await import('@avatio/nuxt/runtime/server/content/local')
        return createLocalContentService(
            contentConfig.contentDirectory,
            contentConfig.locales,
            contentConfig.fallbackLocale,
        )
    }
    const env = getRuntimeEnv(event)
    if (!env.CONTENT_CACHE || !env.STAGE)
        throw createError({ statusCode: 503, message: 'Content configuration is unavailable.' })
    const config = getStageConfig(env.STAGE).content
    return createAvatioContentService({
        ...createGithubContentSource(config),
        ...contentConfig,
        cache: {
            driver: kvDriver({
                binding: env.CONTENT_CACHE,
                base: `authored-content:v1:${config.repo}:${config.branch}`,
            }),
            ttl: 300_000,
            swr: false,
        },
        logger: log,
    })
}
