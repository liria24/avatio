import type {
    PublisherOwnershipDetails,
    PublisherSource,
    PublisherSourceOwnership,
    PublisherSourceSnapshot,
    PublisherVerificationChallenge,
} from '../domain/publisher'

export interface PublisherChallengeDetails {
    challenge: PublisherVerificationChallenge
    source: PublisherSource
}

export interface PublisherRepository {
    upsertSource(snapshot: PublisherSourceSnapshot): Promise<PublisherSource>
    createChallenge(challenge: PublisherVerificationChallenge): Promise<void>
    findChallenge(id: string): Promise<PublisherChallengeDetails | null>
    deleteChallenge(id: string, userId: string): Promise<void>
    consumeChallengeAndCreateOwnership(
        challenge: PublisherVerificationChallenge,
        verifiedAt: Date,
    ): Promise<PublisherSourceOwnership | null>
    listOwnerships(userId: string): Promise<PublisherOwnershipDetails[]>
    deleteOwnership(id: string, userId: string): Promise<boolean>
}
