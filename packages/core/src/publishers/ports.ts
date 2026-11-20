import type {
    PublisherOwnershipDetails,
    PublisherSource,
    PublisherSourceOwnership,
    PublisherSourceSnapshot,
    PublisherVerificationChallenge,
} from './domain/publisher'

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

export interface PublisherVerificationInstruction {
    type: string
    url: string
}

export interface ResolvedPublisherVerificationTarget {
    source: PublisherSourceSnapshot
    method: string
    instruction: PublisherVerificationInstruction
    proof: unknown
}

export interface PublisherVerificationProvider {
    readonly key: string
    resolveTarget(url: URL): Promise<ResolvedPublisherVerificationTarget | null>
    verify(input: { target: ResolvedPublisherVerificationTarget; code: string }): Promise<boolean>
}
