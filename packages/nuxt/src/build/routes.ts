import type { NuxtPage } from '@nuxt/schema'

const isDynamicSegment = (segment: string) =>
    segment.startsWith(':') || segment.startsWith('[') || segment.includes('(')

const joinPagePath = (parentPath: string, path: string) => {
    if (path.startsWith('/')) return path
    return `${parentPath.replace(/\/$/, '')}/${path}`
}

export const derivePageRoutePolicy = (
    pages: readonly NuxtPage[],
    locales: readonly string[],
): { rootPaths: string[]; staticPaths: string[] } => {
    const localeSet = new Set(locales.map((locale) => locale.toLowerCase()))
    const reserved = new Set<string>()
    const staticPaths = new Set<string>()

    const inspectPath = (path: string) => {
        const segments = path.split('/').filter(Boolean)
        if (segments[0] && localeSet.has(segments[0].toLowerCase())) segments.shift()
        const first = segments[0]
        if (first && !isDynamicSegment(first)) reserved.add(first.toLowerCase())
        if (segments.every((segment) => !isDynamicSegment(segment)))
            staticPaths.add(`/${segments.join('/')}`.toLowerCase())
    }

    const visit = (entries: readonly NuxtPage[], parentPath = '') => {
        for (const page of entries) {
            const fullPath = joinPagePath(parentPath, page.path)
            inspectPath(fullPath)
            const aliases = Array.isArray(page.alias) ? page.alias : page.alias ? [page.alias] : []
            for (const alias of aliases) inspectPath(joinPagePath(parentPath, alias))
            if (page.children) visit(page.children, fullPath)
        }
    }

    visit(pages)
    return { rootPaths: [...reserved].sort(), staticPaths: [...staticPaths].sort() }
}

export const deriveReservedRootPaths = (pages: readonly NuxtPage[], locales: readonly string[]) =>
    derivePageRoutePolicy(pages, locales).rootPaths
