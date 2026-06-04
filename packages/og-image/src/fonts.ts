import type { Font, Renderer } from '@takumi-rs/wasm'

export type UnicodeRangeTuple = readonly [number, number]

export interface FontAssetDefinition {
    key: string
    name: string
    path: string
    ranges: readonly UnicodeRangeTuple[]
}

export interface FontLoadContext {
    assets?: Fetcher
    origin?: string
    signal?: AbortSignal
}

const fontCacheMaxBytes = 2 * 1024 * 1024
const fontBufferCache = new Map<string, ArrayBuffer>()
let fontCacheBytes = 0

const fontSubsetRank = (key: string) => {
    if (key === 'latin') return 0
    if (key === 'latin-ext') return 1
    return 2
}

const sortFontsForCoverage = (fonts: readonly FontAssetDefinition[]) =>
    [...fonts].sort((a, b) => {
        const rankDiff = fontSubsetRank(a.key) - fontSubsetRank(b.key)
        if (rankDiff !== 0) return rankDiff

        const aShard = Number.parseInt(a.key, 10)
        const bShard = Number.parseInt(b.key, 10)
        if (Number.isFinite(aShard) && Number.isFinite(bShard)) return aShard - bShard

        return a.key.localeCompare(b.key)
    })

const rangeContains = (range: UnicodeRangeTuple, codePoint: number) =>
    codePoint >= range[0] && codePoint <= range[1]

const fontCovers = (font: FontAssetDefinition, codePoint: number) =>
    font.ranges.some((range) => rangeContains(range, codePoint))

const textCodePoints = (text: string) => {
    const codePoints = new Set<number>()

    for (const char of text) {
        const codePoint = char.codePointAt(0)
        if (codePoint !== undefined) codePoints.add(codePoint)
    }

    return codePoints
}

export const selectFontsForText = (fonts: readonly FontAssetDefinition[], text: string) => {
    const candidates = sortFontsForCoverage(fonts)
    const selected = new Map<string, FontAssetDefinition>()

    for (const codePoint of textCodePoints(text)) {
        const font = candidates.find((candidate) => fontCovers(candidate, codePoint))
        if (font) selected.set(font.key, font)
    }

    return [...selected.values()]
}

const getCachedFontBuffer = (path: string) => {
    const buffer = fontBufferCache.get(path)
    if (!buffer) return undefined

    fontBufferCache.delete(path)
    fontBufferCache.set(path, buffer)
    return buffer
}

const cacheFontBuffer = (path: string, buffer: ArrayBuffer) => {
    if (buffer.byteLength > fontCacheMaxBytes) return buffer

    fontBufferCache.set(path, buffer)
    fontCacheBytes += buffer.byteLength

    while (fontCacheBytes > fontCacheMaxBytes) {
        const oldest = fontBufferCache.entries().next().value
        if (!oldest) break

        const [oldestPath, oldestBuffer] = oldest
        fontBufferCache.delete(oldestPath)
        fontCacheBytes -= oldestBuffer.byteLength
    }

    return buffer
}

const createFontAssetRequest = (path: string, context: FontLoadContext) => {
    if (context.assets)
        return new Request(new URL(path, 'https://og-image-assets.internal'), {
            signal: context.signal,
        })

    if (!context.origin)
        throw new Error('OG image font assets require ASSETS binding or request origin')

    return new Request(new URL(path, context.origin), { signal: context.signal })
}

const fetchFontBuffer = async (font: FontAssetDefinition, context: FontLoadContext) => {
    const cached = getCachedFontBuffer(font.path)
    if (cached) return cached

    const request = createFontAssetRequest(font.path, context)
    const response = context.assets ? await context.assets.fetch(request) : await fetch(request)
    if (!response.ok) throw new Error(`Unable to load OG image font asset: ${font.key}`)

    return cacheFontBuffer(font.path, await response.arrayBuffer())
}

export const loadPresetFonts = async (
    renderer: Renderer,
    preset: { fonts: readonly FontAssetDefinition[] },
    text: string,
    context: FontLoadContext = {},
) => {
    const fontAssets = selectFontsForText(preset.fonts, text)
    const fonts = await Promise.all(
        fontAssets.map(async (font) => ({
            name: font.name,
            data: await fetchFontBuffer(font, context),
        })),
    )

    await renderer.loadFonts(fonts satisfies Font[], context.signal)
}
