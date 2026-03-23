import { joinURL, withHttps, withTrailingSlash } from 'ufo'

export const computeItemUrl = (itemId: string, platform: Platform) => {
    if (platform === 'booth') return joinURL(withHttps(BOOTH_BASE_DOMAIN), 'ja/items', itemId)
    else if (platform === 'github') return joinURL(withHttps('github.com'), itemId)
    else return undefined
}

export const computeShopUrl = (shopId: string | undefined, platform: Platform | undefined) => {
    if (!shopId || !platform) return undefined
    if (platform === 'booth') return withTrailingSlash(withHttps(`${shopId}.${BOOTH_BASE_DOMAIN}`))
    else if (platform === 'github') return joinURL(withHttps('github.com'), shopId)
    return undefined
}
