import { parseHost, parseURL, withoutTrailingSlash } from 'ufo'

interface ExtractResult {
    id: string
    platform: Platform
}

// プラットフォーム別の抽出ロジック
const platformHandlers = [
    {
        domain: 'booth.pm',
        platform: 'booth' as Platform,
        extractId: (pathname: string): string | null => {
            const match = pathname.match(/\/(?:[a-z]{2}\/)?items?\/(\d+)/)
            return match?.[1] ?? null
        },
    },
    {
        domain: 'github.com',
        platform: 'github' as Platform,
        extractId: (pathname: string): string | null => {
            const match = withoutTrailingSlash(pathname).match(/^\/([^/]+\/[^/]+)$/)
            return match?.[1] ?? null
        },
    },
]

export default (url: string): ExtractResult | null => {
    const parsed = parseURL(url, 'https://')
    if (!parsed.host) return null

    const { hostname } = parseHost(parsed.host)

    for (const handler of platformHandlers)
        if (hostname.endsWith(handler.domain)) {
            const id = handler.extractId(parsed.pathname ?? '')
            if (id) return { id, platform: handler.platform }
            return null
        }

    // サポートされていないプラットフォームの場合はnullを返す
    return null
}
