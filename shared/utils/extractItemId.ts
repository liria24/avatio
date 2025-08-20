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
]
export default (url: string): ExtractResult | null => {
    try {
        const parsedUrl = new URL(url)

        // 対応するプラットフォームを検索
        for (const handler of platformHandlers) {
            // Security fix: Use exact hostname match to prevent subdomain bypass
            if (parsedUrl.hostname === handler.domain || parsedUrl.hostname === `www.${handler.domain}`) {
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
