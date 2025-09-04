export const computeItemUrl = (itemId: string, platform: Platform) => {
    if (platform === 'booth') return `https://booth.pm/ja/items/${itemId}`
    else if (platform === 'github') return `https://github.com/${itemId}`
    else return undefined
}

export const computeShopUrl = (
    shopId: string | undefined,
    platform: Platform | undefined
) => {
    if (!shopId || !platform) return undefined
    if (platform === 'booth') return `https://${shopId}.booth.pm/`
    else if (platform === 'github') return `https://github.com/${shopId}`
    return undefined
}
