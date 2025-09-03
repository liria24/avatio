export const transformItemId = (itemId: string) => {
    const encode = () =>
        itemId
            .split('/')
            .map((part) => encodeURIComponent(part))
            .join('+')

    const decode = () =>
        itemId
            .split('+')
            .map((part) => decodeURIComponent(part))
            .join('/')

    return { encode, decode }
}

interface ExtractResult {
    id: string
    platform: Platform
}

// プラットフォーム別の抽出ロジック
const platformHandlers = [
    {
        domain: 'booth.pm',
        platform: 'booth' as Platform,
        extractId: (url: URL): string | null => {
            const match = url.pathname.match(/\/(?:[a-z]{2}\/)?items?\/(\d+)/)
            return match?.[1] || null
        },
    },
    {
        domain: 'github.com',
        platform: 'github' as Platform,
        extractId: (url: URL): string | null => {
            if (url.hostname !== 'github.com') return null
            const match = url.pathname.match(/^\/([^/]+\/[^/]+)\/?$/)
            if (!match?.[1]) return null
            return transformItemId(match[1]).encode()
        },
    },
]

export default (url: string): ExtractResult | null => {
    try {
        const parsedUrl = new URL(url)

        // 対応するプラットフォームを検索
        for (const handler of platformHandlers) {
            if (parsedUrl.hostname.endsWith(handler.domain)) {
                const id = handler.extractId(parsedUrl)
                if (id) return { id, platform: handler.platform }

                // IDが抽出できない場合はnullを返す
                return null
            }
        }

        // サポートされていないプラットフォームの場合はnullを返す
        return null
    } catch (error) {
        // URLのパースに失敗した場合はnullを返す
        console.error('Failed to parse URL:', error)
        return null
    }
}
