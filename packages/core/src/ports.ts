import type { CatalogClassificationChoice, CatalogItemId } from './catalog'
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
    isEnabled(flag: 'maintenance'): Promise<boolean>
}

export interface StoredFile {
    key: string
    url: string
}

export interface FileStorage {
    importFromUrl(input: { sourceUrl: string; destinationKey: string }): Promise<StoredFile>
}

export interface CatalogDisplayNameInput {
    name: string
    description?: string
    readme?: string
    examples?: Array<{
        name: string
        displayName: string | null
    }>
}

export interface CatalogDisplayNameGenerator {
    generate(input: CatalogDisplayNameInput): Promise<string | null>
}

export interface CatalogClassificationInput {
    name: string
    description?: string
    readme?: string
    originalCategory?: string
}

export interface CatalogClassificationResult {
    category: CatalogClassificationChoice
    confidence: number
    probabilities: Record<string, number>
    model: string
}

export interface CatalogItemClassifier {
    classify(
        input: CatalogClassificationInput,
        options?: { signal?: AbortSignal },
    ): Promise<CatalogClassificationResult>
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
