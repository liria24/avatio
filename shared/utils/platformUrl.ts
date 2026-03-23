import { joinURL, withHttps, withTrailingSlash } from 'ufo'

export const computeItemUrl = (itemId: string, platform: Platform) => {
    if (platform === 'booth')
        return joinURL(withHttps(BOOTH_BASE_DOMAIN), 'ja/items', String(itemId))
    else if (platform === 'github') return joinURL(withHttps('github.com'), String(itemId))
    else return undefined
}

export const computeShopUrl = (shopId: string | undefined, platform: Platform | undefined) => {
    if (!shopId || !platform) return undefined
    if (platform === 'booth') return withTrailingSlash(withHttps(`${shopId}.${BOOTH_BASE_DOMAIN}`))
    else if (platform === 'github') return joinURL(withHttps('github.com'), String(shopId))
    return undefined
}
