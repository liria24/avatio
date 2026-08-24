import type { MarkdownDocument, Node } from 'comark'

export interface ContentFrontmatter {
    title: string
    description?: string
    image?: string
    updatedAt?: string
    effectiveDate?: string
    commitLogPath?: string
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
}

export interface AvatioContentPage extends AvatioSourceContentPage {
    requestedLocale: string
    isFallback: boolean
}

const nodeText = (node: Node): string => {
    if (typeof node === 'string') return node
    if (node[0] === null) return ''
    return node
        .slice(2)
        .map((child) => nodeText(child as Node))
        .join('')
}

export const buildContentToc = (document: MarkdownDocument): ContentTocLink[] => {
    const links: ContentTocLink[] = []
    let currentParent: ContentTocLink | undefined

    for (const node of document.nodes) {
        if (typeof node === 'string' || node[0] === null || !/^h[2-3]$/.test(node[0])) continue
        const depth = Number(node[0].slice(1))
        const id = typeof node[1].id === 'string' ? node[1].id : ''
        if (!id) continue
        const link: ContentTocLink = { id, text: nodeText(node), depth }
        if (depth === 2) {
            links.push(link)
            currentParent = link
        } else if (currentParent) {
            ;(currentParent.children ??= []).push(link)
        } else {
            links.push(link)
        }
    }

    return links
}

export const resolveContentPage = (
    pages: Readonly<Record<string, AvatioSourceContentPage>>,
    requestedLocale: string,
    slug: string,
    fallbackLocale: string,
): AvatioContentPage | null => {
    const requested = pages[`${requestedLocale}:${slug}`]
    if (requested) return { ...requested, requestedLocale, isFallback: false }
    const fallback = pages[`${fallbackLocale}:${slug}`]
    return fallback ? { ...fallback, requestedLocale, isFallback: true } : null
}
