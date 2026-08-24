import { matchCatalogUrl } from '@avatio/nuxt/runtime/catalog/references'

import { platformSchema } from '../types/database'

interface ExtractResult {
    id: string
    platform: Platform
}

export default (url: string): ExtractResult | null => {
    const reference = matchCatalogUrl(url)
    const platform = platformSchema.safeParse(reference?.providerKey)
    if (!reference || !platform.success) return null

    return { id: reference.externalId, platform: platform.data }
}
