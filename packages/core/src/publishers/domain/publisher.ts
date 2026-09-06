export type PublisherId = string
export type PublisherSourceId = string

export interface Publisher {
    id: PublisherId
    displayNameOverride: string | null
    imageOverride: string | null
    createdAt: Date
    updatedAt: Date
}

export interface PublisherSource {
    id: PublisherSourceId
    publisherId: PublisherId
    providerKey: string
    externalId: string
    canonicalUrl: string
    name: string
    image: string | null
    providerVerified: boolean
    metadata: Record<string, unknown>
}

export type PublisherSourceSnapshot = Omit<PublisherSource, 'id' | 'publisherId'>

export interface PublisherSourceOwnership {
    id: string
    userId: string
    publisherSourceId: PublisherSourceId
    method: string
    verifiedAt: Date
}

export interface PublisherVerificationChallenge {
    id: string
    userId: string
    publisherSourceId: PublisherSourceId
    method: string
    code: string
    createdAt: Date
    expiresAt: Date
}

export interface PublisherOwnershipDetails extends PublisherSourceOwnership {
    source: PublisherSource
    publisher: Publisher
}
