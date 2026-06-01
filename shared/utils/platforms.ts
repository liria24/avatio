import { joinURL, withHttps, withTrailingSlash } from 'ufo'

const platforms: Record<
    Platform,
    {
        icon: string
        label: string
        itemUrl: (id: string) => string
        shopUrl: (id: string) => string
    }
> = {
    booth: {
        icon: 'avatio:booth',
        label: 'BOOTH',
        itemUrl: (id) => joinURL('https://booth.pm', 'ja/items', String(id)),
        shopUrl: (id) => withTrailingSlash(withHttps(`${id}.booth.pm`)),
    },
    github: {
        icon: 'mingcute:github-fill',
        label: 'GitHub',
        itemUrl: (id) => joinURL(withHttps('github.com'), String(id)),
        shopUrl: (id) => joinURL(withHttps('github.com'), String(id)),
    },
}

export const getPlatformData = (platform: Platform) => platforms[platform]

export const resolveItemUrl = (itemId: string, platform: Platform): string | undefined =>
    getPlatformData(platform)?.itemUrl(itemId)

export const resolveShopUrl = (shopId: string | undefined, platform: Platform | undefined) => {
    if (!shopId || !platform) return undefined
    return getPlatformData(platform)?.shopUrl(shopId)
}
