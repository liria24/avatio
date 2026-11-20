import { JEV_CATALOG_CLASSIFIER_VERSION } from '@avatio/cloudflare'
import type {
    CatalogClassification,
    CatalogClassificationInput,
    CatalogRepository,
    ItemSource,
    ItemSourceSnapshot,
} from '@avatio/core'
import type { H3Event } from '@nuxt/nitro-server/h3'

const CLASSIFICATION_CONFIDENCE = 0.85
const CLASSIFICATION_TIMEOUT_MS = 2_000
const CLASSIFICATION_LEASE_MS = 30_000
const CLASSIFICATION_RETRY_MS = 5 * 60_000
const log = logger('classifyCatalogSource')

const optionalText = (value: unknown, limit: number) => {
    if (typeof value !== 'string') return undefined
    const normalized = value.trim().slice(0, limit)
    return normalized || undefined
}

const classificationInput = (snapshot: ItemSourceSnapshot): CatalogClassificationInput => {
    const originalCategory = snapshot.category
        ? [snapshot.category.rawLabel, snapshot.category.rawKey, snapshot.category.mappedCategory]
              .filter(Boolean)
              .join(' / ')
        : undefined
    return {
        name: snapshot.name.trim().slice(0, 300),
        description: optionalText(snapshot.metadata.description, 4_000),
        readme: optionalText(snapshot.metadata.readme, 8_000),
        originalCategory,
    }
}

const hashInput = async (input: CatalogClassificationInput) => {
    const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(JSON.stringify(input)),
    )
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

const matchesCurrentInput = (
    classification: CatalogClassification,
    source: ItemSource,
    inputHash: string,
    requestedModel: string,
) =>
    classification.sourceId === source.id &&
    classification.sourceUpdatedAt.getTime() === source.updatedAt.getTime() &&
    classification.inputHash === inputHash &&
    classification.classifierVersion === JEV_CATALOG_CLASSIFIER_VERSION &&
    classification.requestedModel === requestedModel

const waitForClassification = async (
    repository: CatalogRepository,
    source: ItemSource,
    inputHash: string,
    requestedModel: string,
) => {
    const deadline = Date.now() + CLASSIFICATION_TIMEOUT_MS
    while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 100))
        const current = await repository.findClassification(source.itemId)
        if (
            !current ||
            !matchesCurrentInput(current, source, inputHash, requestedModel) ||
            current.status !== 'processing'
        )
            return
    }
}

export const classifyCatalogSource = async (
    event: H3Event,
    repository: CatalogRepository,
    source: ItemSource,
) => {
    if (!source.snapshot) return
    const configured = getCatalogItemClassifier(event)
    if (!configured) return
    const item = await repository.findItem(source.itemId)
    if (!item || (item.categoryOverrideOrigin && item.categoryOverrideOrigin !== 'ai')) return

    const input = classificationInput(source.snapshot)
    const inputHash = await hashInput(input)
    const now = new Date()
    const current = await repository.findClassification(source.itemId)
    if (current && matchesCurrentInput(current, source, inputHash, configured.model)) {
        if (current.status === 'resolved' || current.status === 'uncertain') return
        if (current.status === 'error' && current.retryAt && current.retryAt > now) return
        if (current.status === 'processing' && current.leaseUntil && current.leaseUntil > now) {
            await waitForClassification(repository, source, inputHash, configured.model)
            return
        }
    }

    const lease = await repository.claimClassification({
        itemId: source.itemId,
        sourceId: source.id,
        sourceUpdatedAt: source.updatedAt,
        inputHash,
        classifierVersion: JEV_CATALOG_CLASSIFIER_VERSION,
        requestedModel: configured.model,
        now,
        leaseUntil: new Date(now.getTime() + CLASSIFICATION_LEASE_MS),
    })
    if (!lease) {
        await waitForClassification(repository, source, inputHash, configured.model)
        return
    }

    try {
        const result = await configured.classifier.classify(input, {
            signal: AbortSignal.timeout(CLASSIFICATION_TIMEOUT_MS),
        })
        const accepted =
            result.category !== 'unknown' && result.confidence >= CLASSIFICATION_CONFIDENCE
        await repository.completeClassification({
            lease,
            responseModel: result.model,
            category: result.category,
            confidence: result.confidence,
            probabilities: result.probabilities,
            accepted,
            completedAt: new Date(),
        })
        if (accepted)
            await invalidateCacheResources(
                event,
                { items: [source.itemId], collections: [EDGE_CACHE_TAGS.items] },
                'catalog classification',
            )
    } catch (error) {
        const failedAt = new Date()
        const errorKind =
            error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name)
                ? 'timeout'
                : 'inference'
        await repository
            .failClassification({
                lease,
                errorKind,
                retryAt: new Date(failedAt.getTime() + CLASSIFICATION_RETRY_MS),
                failedAt,
            })
            .catch((failure: unknown) =>
                log.warn('Could not record catalog classification failure', {
                    sourceId: source.id,
                    error: String(failure),
                }),
            )
        log.warn('Catalog classification failed', { sourceId: source.id, error: String(error) })
    }
}
