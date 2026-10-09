import type { CloudflareResourceInventory } from '../../config/cloudflare'
import { getStageConfig } from '../../config/environment.ts'

/** Synthetic IDs only: never import this fixture into deployment tooling. */
export const createCloudflareResourceFixture = (): CloudflareResourceInventory => {
    const resources = (number: number, stage: 'production' | 'development') => {
        const config = getStageConfig(stage)
        return {
            database: {
                id: `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`,
                name: config.infrastructure.appDatabase,
            },
            cache: {
                id: String(number).padStart(32, '0'),
                name: config.infrastructure.cache,
            },
            bucket: config.infrastructure.bucket,
            flagshipId: stage === 'production' ? 'production-flags' : 'test-flags',
            rateLimitNamespaces: config.infrastructure.rateLimitNamespaces,
            siteUrl: config.siteUrl,
            imageBaseUrl: config.imageBaseUrl,
            ...(stage === 'production'
                ? { emailFrom: config.emailFrom, analyticsSiteTag: 'production-site' }
                : {}),
        }
    }
    return {
        accountId: '0'.repeat(32),
        production: resources(1, 'production'),
        development: {
            ...resources(2, 'development'),
            siteUrl: 'https://development.previews.example.test',
        },
    }
}
