import { copyFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath, URL } from 'node:url'

import type { Plugin } from 'rollup'

type UnicodeRangeTuple = readonly [number, number]

interface ParsedFontFace {
    family: string
    file: string
    key: string
    ranges: UnicodeRangeTuple[]
}

interface FontAssetManifestEntry {
    key: string
    name: string
    path: string
    ranges: UnicodeRangeTuple[]
}

interface FontAssetConfig {
    moduleId: string
    packageName: string
    publicBaseURL: string
    generatedDir: string
    includeSubset: (font: ParsedFontFace) => boolean
    cssFile?: string
    filesDir?: string
    sortSubsets?: (a: ParsedFontFace, b: ParsedFontFace) => number
}

interface PreparedFontAsset {
    publicAsset: {
        dir: string
        baseURL: string
        maxAge: number
    }
    plugin: Plugin
}

const require = createRequire(import.meta.url)
const defaultPublicMaxAgeSeconds = 60 * 60 * 24 * 365

const parseUnicodeRangeToken = (token: string): UnicodeRangeTuple | undefined => {
    const normalized = token.trim().replace(/^U\+/i, '')
    const [startValue, endValue] = normalized.split('-')
    if (!startValue) return undefined

    const start = Number.parseInt(startValue, 16)
    const end = Number.parseInt(endValue ?? startValue, 16)
    if (!Number.isFinite(start) || !Number.isFinite(end)) return undefined

    return [start, end]
}

const parseUnicodeRanges = (value: string) =>
    value
        .split(',')
        .map(parseUnicodeRangeToken)
        .filter((range): range is UnicodeRangeTuple => Boolean(range))

const inferSubsetKey = (packageName: string, file: string) => {
    const packageSlug = packageName.split('/').pop()
    const fileSlug = basename(file, '.woff2').replace(/-wght-normal$/, '')

    return packageSlug && fileSlug.startsWith(`${packageSlug}-`)
        ? fileSlug.slice(packageSlug.length + 1)
        : fileSlug
}

const parseFontFaces = (packageName: string, cssPath: string) => {
    const css = readFileSync(cssPath, 'utf8')
    const fonts: ParsedFontFace[] = []

    for (const match of css.matchAll(/@font-face\s*{(?<body>[\s\S]*?)}/g)) {
        const body = match.groups?.body
        if (!body) continue

        const family = /font-family:\s*['"]([^'"]+)['"]/.exec(body)?.[1]
        const file = /src:\s*url\(\.\/files\/([^)]+)\)/.exec(body)?.[1]
        const unicodeRange = /unicode-range:\s*([^;]+);/.exec(body)?.[1]
        if (!family || !file || !unicodeRange) continue

        fonts.push({
            family,
            file,
            key: inferSubsetKey(packageName, file),
            ranges: parseUnicodeRanges(unicodeRange),
        })
    }

    return fonts
}

export const includeLatinAndNumberedSubsets =
    ({ maxNumberedShard }: { maxNumberedShard: number }) =>
    ({ key }: ParsedFontFace) => {
        if (key === 'latin' || key === 'latin-ext') return true
        if (!/^\d+$/.test(key)) return false

        const shard = Number.parseInt(key, 10)
        return shard >= 0 && shard <= maxNumberedShard
    }

const latinAndNumberedSubsetRank = (key: string) => {
    if (key === 'latin') return 0
    if (key === 'latin-ext') return 1
    return 2
}

export const sortLatinAndNumberedSubsets = (a: ParsedFontFace, b: ParsedFontFace) => {
    const rankDiff = latinAndNumberedSubsetRank(a.key) - latinAndNumberedSubsetRank(b.key)
    if (rankDiff !== 0) return rankDiff

    const aShard = Number.parseInt(a.key, 10)
    const bShard = Number.parseInt(b.key, 10)
    if (Number.isFinite(aShard) && Number.isFinite(bShard)) return aShard - bShard

    return a.key.localeCompare(b.key)
}

const uniqueFontFamily = (font: ParsedFontFace) => `${font.family} ${font.key}`

const cssFontFamily = (fontFamily: string) => JSON.stringify(fontFamily)

const prepareFontAsset = (configUrl: string, config: FontAssetConfig): PreparedFontAsset => {
    const packageRoot = dirname(require.resolve(`${config.packageName}/package.json`))
    const cssPath = join(packageRoot, config.cssFile ?? 'index.css')
    const filesDir = join(packageRoot, config.filesDir ?? 'files')
    const generatedDir = fileURLToPath(new URL(config.generatedDir, configUrl))
    const resolvedModuleId = `\0${config.moduleId}`
    const fontFaces = parseFontFaces(config.packageName, cssPath).filter(config.includeSubset)
    if (config.sortSubsets) fontFaces.sort(config.sortSubsets)

    const entries = fontFaces.map(
        (font): FontAssetManifestEntry => ({
            key: font.key,
            name: uniqueFontFamily(font),
            path: `${config.publicBaseURL}/${font.file}`,
            ranges: font.ranges,
        }),
    )

    rmSync(generatedDir, { recursive: true, force: true })
    mkdirSync(generatedDir, { recursive: true })

    for (const entry of entries) {
        const fileName = entry.path.split('/').pop()
        if (!fileName) continue

        copyFileSync(join(filesDir, fileName), join(generatedDir, fileName))
    }

    return {
        publicAsset: {
            dir: generatedDir,
            baseURL: config.publicBaseURL,
            maxAge: defaultPublicMaxAgeSeconds,
        },
        plugin: {
            name: `og-image-font-manifest:${config.moduleId}`,
            resolveId(id) {
                return id === config.moduleId ? resolvedModuleId : null
            },
            load(id) {
                if (id !== resolvedModuleId) return null

                this.addWatchFile(cssPath)
                const fontFamily = entries.map((entry) => cssFontFamily(entry.name)).join(', ')
                return [
                    `export const fontFamily = ${JSON.stringify(fontFamily)}`,
                    `export const fonts = ${JSON.stringify(entries)}`,
                ].join('\n')
            },
        },
    }
}

export const createFontAssets = (configUrl: string, configs: FontAssetConfig[]) => {
    const prepared = configs.map((config) => prepareFontAsset(configUrl, config))

    return {
        plugins: prepared.map(({ plugin }) => plugin),
        publicAssets: prepared.map(({ publicAsset }) => publicAsset),
    }
}
