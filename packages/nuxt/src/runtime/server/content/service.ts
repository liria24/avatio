import { legalDocuments, legalVersionSchema, type LegalDocumentMetadata } from '@avatio/core/legal'
import { comarkContent, type CacheOptions, type Source, type ContentOptions } from 'comark-content'
import toc, { type Toc } from 'comark/plugins/toc'
import { z } from 'zod'

import type { AvatioContentPage, ContentSourceMetadata } from '../../content'

export const contentFrontmatterSchema = z
    .object({
        title: z.string().min(1),
        description: z.string().optional(),
        image: z.string().optional(),
        updatedAt: z.iso.date().optional(),
        effectiveDate: z.iso.date().optional(),
        version: z.string().min(1).optional(),
        schemaOrg: z
            .union([z.record(z.string(), z.unknown()), z.array(z.record(z.string(), z.unknown()))])
            .optional(),
        sitemap: z.record(z.string(), z.unknown()).optional(),
        robots: z.union([z.string(), z.boolean()]).optional(),
        head: z.record(z.string(), z.unknown()).optional(),
        seo: z.record(z.string(), z.unknown()).optional(),
    })
    .catchall(z.unknown())

const provenanceSchema = z.object({
    path: z.string(),
    sourceRevision: z.string().min(1),
    sourceCommit: z.string().optional(),
    sourceUrl: z.url().optional(),
    historyUrl: z.url().optional(),
})

export interface AvatioContentOptions {
    source: Source
    sourceMetadata: (
        key: string,
    ) =>
        | Omit<ContentSourceMetadata, 'sourceRevision'>
        | Promise<Omit<ContentSourceMetadata, 'sourceRevision'>>
    locales: readonly string[]
    fallbackLocale: string
    cache?: CacheOptions | false
    logger?: ContentOptions['logger']
}

export const createAvatioContentService = (options: AvatioContentOptions) => {
    const revisions = new Map<string, ContentSourceMetadata>()
    const content = comarkContent({
        source: {
            ...options.source,
            async getItem(key) {
                const raw = await options.source.getItem(key)
                const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
                revisions.set(key, {
                    ...(await options.sourceMetadata(key)),
                    sourceRevision: `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`,
                })
                return raw
            },
        },
        cache: options.cache,
        markdown: { plugins: [toc({ depth: 3, searchDepth: 3 })] },
        logger: options.logger ?? false,
        onError: 'throw',
    })
    content.hooks.hook('file:parsed', ({ file }) => {
        if (!file) return
        file.data = contentFrontmatterSchema.parse(file.data)
        if (legalDocuments.some((slug) => file.path.endsWith(`/${slug}`)))
            legalVersionSchema.parse(file.data)
        const key = file.meta.key.slice(file.meta.source.length + 1)
        const source = revisions.get(key)
        if (source) file.meta.provenance = source
    })

    const resolveMetadata = async (slug: string, locale: string) => {
        if (!options.locales.includes(locale)) throw new Error('Unsupported content locale.')
        await content.init()
        return (
            content.stat(`/${locale}/${slug}`) ??
            content.stat(`/${options.fallbackLocale}/${slug}`) ??
            null
        )
    }

    return {
        async getPage(slug: string, requestedLocale: string): Promise<AvatioContentPage | null> {
            const metadata = await resolveMetadata(slug, requestedLocale)
            if (!metadata) return null
            let file = await content.get(metadata.path)
            if (!file) return null
            if (
                provenanceSchema.parse(file.meta.provenance).sourceRevision !==
                provenanceSchema.parse(metadata.meta.provenance).sourceRevision
            ) {
                const key = file.meta.key.slice(file.meta.source.length + 1)
                if (
                    provenanceSchema.parse(file.meta.provenance).sourceRevision !==
                    revisions.get(key)?.sourceRevision
                ) {
                    file = await content.get(metadata.path, { fresh: true })
                    if (!file) return null
                }
                if (
                    provenanceSchema.parse(file.meta.provenance).sourceRevision !==
                    provenanceSchema.parse(metadata.meta.provenance).sourceRevision
                ) {
                    // get() already cached the document; update() would write its KV key twice.
                    Object.assign(metadata, { data: file.data, meta: file.meta })
                    await content.cache.set('manifest', content.manifest)
                }
            }
            const frontmatter = contentFrontmatterSchema.parse(file.data)
            const locale = file.path.split('/')[1] ?? options.fallbackLocale
            return {
                locale,
                slug,
                requestedLocale,
                isFallback: locale !== requestedLocale,
                frontmatter,
                document: { nodes: file.nodes, frontmatter, meta: file.meta },
                toc: (file.meta.toc as Toc | undefined)?.links ?? [],
                source: provenanceSchema.parse(file.meta.provenance),
            }
        },
        async getLegalDocuments(locale: string): Promise<LegalDocumentMetadata[]> {
            return Promise.all(
                legalDocuments.map(async (document) => {
                    const metadata = await resolveMetadata(document, locale)
                    const canonical = await resolveMetadata(document, options.fallbackLocale)
                    if (!metadata || !canonical)
                        throw new Error(`Legal document unavailable: ${document}`)
                    const version = legalVersionSchema.parse(metadata.data)
                    const canonicalVersion = legalVersionSchema.parse(canonical.data)
                    if (
                        version.version !== canonicalVersion.version ||
                        version.effectiveDate !== canonicalVersion.effectiveDate
                    )
                        throw new Error(`Legal translation version differs: ${document}`)
                    const source = provenanceSchema.parse(metadata.meta.provenance)
                    return {
                        document,
                        ...version,
                        locale: metadata.path.split('/')[1] ?? options.fallbackLocale,
                        sourceRevision: source.sourceRevision,
                        sourceCommit: source.sourceCommit,
                    }
                }),
            )
        },
    }
}
