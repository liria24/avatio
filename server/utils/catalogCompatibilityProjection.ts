const metadataNumber = (metadata: Record<string, unknown> | null, key: string) => {
    const value = metadata?.[key]
    return typeof value === 'number' ? value : undefined
}

const metadataString = (metadata: Record<string, unknown> | null, key: string) => {
    const value = metadata?.[key]
    return typeof value === 'string' ? value : undefined
}

const metadataContributors = (metadata: Record<string, unknown> | null) => {
    const contributors = metadata?.contributors
    if (!Array.isArray(contributors)) return undefined
    return contributors.flatMap((contributor) => {
        if (!contributor || typeof contributor !== 'object') return []
        const name = Reflect.get(contributor, 'name')
        const avatar = Reflect.get(contributor, 'avatar')
        if (typeof name !== 'string') return []
        return [{ name, ...(typeof avatar === 'string' ? { avatar } : {}) }]
    })
}

interface LegacySetupItemProjectionInput {
    source: {
        providerKey: string
        externalId: string
        displayName: string
        image: string | null
        price: string | null
        popularityCount: number | null
        nsfw: boolean
        metadata: Record<string, unknown> | null
        publisherSource: {
            externalId: string
            name: string
            image: string | null
            providerVerified: boolean
        } | null
    }
    displayNameOverride: string | null
    category: ItemCategory
    unsupported: boolean
    note: string | null
    shapekeys: SetupItem['shapekeys']
}

/**
 * Temporary adapter for the pre-v2 client shape. Unknown providers are absent
 * only because that legacy DTO has a closed platform union; the v2 Catalog and
 * Setup domains do not branch on provider keys.
 */
export const projectCatalogSourceToLegacySetupItem = (
    input: LegacySetupItemProjectionInput,
): SetupItem | null => {
    const platform = platformSchema.safeParse(input.source.providerKey)
    if (!platform.success) return null

    const publisher = input.source.publisherSource
    return {
        id: input.source.externalId,
        platform: platform.data,
        category: input.category,
        name: input.source.displayName,
        niceName: input.displayNameOverride,
        image: input.source.image,
        price: input.source.price,
        likes: input.source.popularityCount,
        nsfw: input.source.nsfw,
        outdated: false,
        shop: publisher
            ? {
                  id: publisher.externalId,
                  platform: platform.data,
                  name: publisher.name,
                  image: publisher.image,
                  verified: publisher.providerVerified,
              }
            : null,
        unsupported: input.unsupported,
        note: input.note,
        shapekeys: input.shapekeys,
        forks: metadataNumber(input.source.metadata, 'forks'),
        version: metadataString(input.source.metadata, 'version'),
        contributors: metadataContributors(input.source.metadata),
    }
}
