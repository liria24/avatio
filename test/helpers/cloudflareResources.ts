import type { CloudflareResourceInventory } from '../../config/cloudflare'
import { getStageConfig } from '../../config/environment.ts'

/** Synthetic IDs only: never import this fixture into deployment tooling. */
export const createCloudflareResourceFixture = (): CloudflareResourceInventory => {
    const resources = (
        number: number,
        stage: 'production' | 'development',
        previewName?: string,
    ) => {
        const config = getStageConfig(stage)
        const name = previewName ? `avatio-${previewName}` : undefined
        return {
            database: {
                id: `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`,
                name: name ?? config.infrastructure.appDatabase,
            },
            cache: {
                id: String(number).padStart(32, '0'),
                name: name ?? config.infrastructure.cache,
            },
            bucket: name ?? config.infrastructure.bucket,
            flagshipId: stage === 'production' ? 'production-flags' : 'test-flags',
            rateLimitNamespaces: name
                ? ([3000 + number * 4, 3001 + number * 4, 3002 + number * 4, 3003 + number * 4] as [
                      number,
                      number,
                      number,
                      number,
                  ])
                : config.infrastructure.rateLimitNamespaces,
            siteUrl: previewName ? `https://${previewName}.previews.example.test` : config.siteUrl,
            imageBaseUrl: previewName
                ? `https://${previewName}.images.example.test`
                : config.imageBaseUrl,
            ...(stage === 'production' ? { emailFrom: config.emailFrom } : {}),
            ...(stage === 'production' ? { analyticsSiteTag: 'production-site' } : {}),
        }
    }
    return {
        accountId: '0'.repeat(32),
        sharedPreviewStorage: {
            database: {
                id: '00000000-0000-4000-8000-000000000003',
                name: 'avatio-preview-shared',
            },
            bucket: 'avatio-preview-shared',
            imageBaseUrl: 'https://shared.images.example.test',
        },
        production: resources(1, 'production'),
        development: {
            ...resources(2, 'development'),
            siteUrl: 'https://development.previews.example.test',
        },
        previews: {
            'pr-354': resources(354, 'development', 'pr-354'),
            'pr-355': resources(355, 'development', 'pr-355'),
        },
    }
}
