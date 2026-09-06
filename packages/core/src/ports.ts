import type { CatalogItemId, ItemSourceId } from './catalog'
import type { SetupId } from './setups'

export interface CacheInvalidationInput {
    items?: CatalogItemId[]
    setups?: SetupId[]
    users?: string[]
    collections?: string[]
}

export interface CacheInvalidator {
    invalidate(input: CacheInvalidationInput): Promise<void>
}

export interface FeatureFlags {
    isEnabled(flag: 'maintenance' | 'catalogV2Reads' | 'catalogV2Writes'): Promise<boolean>
}

export interface StoredFile {
    key: string
    url: string
}

export interface FileStorage {
    importFromUrl(input: { sourceUrl: string; destinationKey: string }): Promise<StoredFile>
    delete(key: string): Promise<void>
}

export interface CatalogEnrichmentInput {
    sourceId: ItemSourceId
    name: string
    description?: string
    readme?: string
    originalCategory?: string
    examples?: Array<{
        name: string
        displayName: string | null
        category: string
    }>
}

export interface CatalogEnrichmentResult {
    displayName: string | null
    category: string | null
}

export interface CatalogItemEnricher {
    enrich(input: CatalogEnrichmentInput): Promise<CatalogEnrichmentResult>
}

export interface ChangelogTranslationInput {
    title: string
    content: string
    sourceLocale: string
    targetLocale: string
}

export interface ChangelogTranslator {
    translate(input: ChangelogTranslationInput): Promise<{ title: string; content: string }>
}

export interface ChangelogSlugGenerator {
    generate(input: { title: string; reservedSlugs?: string[] }): Promise<string>
}
