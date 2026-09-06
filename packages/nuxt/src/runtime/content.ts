import type { MarkdownDocument } from 'comark'

export interface ContentFrontmatter {
    title: string
    description?: string
    image?: string
    updatedAt?: string
    effectiveDate?: string
    version?: string
    schemaOrg?: Record<string, unknown> | Record<string, unknown>[]
    sitemap?: Record<string, unknown>
    robots?: string | boolean
    head?: Record<string, unknown>
    seo?: Record<string, unknown>
    [key: string]: unknown
}

export interface ContentTocLink {
    id: string
    text: string
    depth: number
    children?: ContentTocLink[]
}

export interface AvatioSourceContentPage {
    locale: string
    slug: string
    frontmatter: ContentFrontmatter
    document: MarkdownDocument<Record<string, unknown>, ContentFrontmatter>
    toc: ContentTocLink[]
    source: ContentSourceMetadata
}

export interface ContentSourceMetadata {
    path: string
    sourceRevision: string
    sourceCommit?: string
    sourceUrl?: string
    historyUrl?: string
}

export interface AvatioContentPage extends AvatioSourceContentPage {
    requestedLocale: string
    isFallback: boolean
}
