import type { PublisherSourceOwnership } from '../domain/publisher'
import type { PublisherRepository } from '../ports/publisher-repository'
import type { PublisherVerificationProviderRegistry } from './provider-registry'

const challengeLifetimeMs = 15 * 60 * 1000

export type PublisherVerificationErrorCode =
    | 'unsupported-target'
    | 'challenge-not-found'
    | 'challenge-expired'
    | 'target-mismatch'
    | 'proof-not-found'
    | 'challenge-consumed'

export class PublisherVerificationError extends Error {
    constructor(readonly code: PublisherVerificationErrorCode) {
        super(code)
    }
}

export const createPublisherVerificationChallenge = async (input: {
    userId: string
    url: URL
    repository: PublisherRepository
    providers: PublisherVerificationProviderRegistry
    now?: Date
    generateId?: () => string
    generateCode?: () => string
}) => {
    const resolved = await input.providers.resolve(input.url)
    if (!resolved) throw new PublisherVerificationError('unsupported-target')

    const source = await input.repository.upsertSource(resolved.target.source)
    const now = input.now ?? new Date()
    const challenge = {
        id: input.generateId?.() ?? crypto.randomUUID(),
        userId: input.userId,
        publisherSourceId: source.id,
        method: resolved.target.method,
        code: input.generateCode?.() ?? crypto.randomUUID().replaceAll('-', ''),
        createdAt: now,
        expiresAt: new Date(now.getTime() + challengeLifetimeMs),
    }
    await input.repository.createChallenge(challenge)

    return {
        id: challenge.id,
        code: challenge.code,
        expiresAt: challenge.expiresAt,
        source,
        instruction: resolved.target.instruction,
    }
}

export const verifyPublisherVerificationChallenge = async (input: {
    id: string
    userId: string
    url: URL
    repository: PublisherRepository
    providers: PublisherVerificationProviderRegistry
    now?: Date
}): Promise<PublisherSourceOwnership> => {
    const details = await input.repository.findChallenge(input.id)
    if (!details || details.challenge.userId !== input.userId)
        throw new PublisherVerificationError('challenge-not-found')

    const now = input.now ?? new Date()
    if (details.challenge.expiresAt.getTime() <= now.getTime()) {
        await input.repository.deleteChallenge(details.challenge.id, input.userId)
        throw new PublisherVerificationError('challenge-expired')
    }

    const provider = input.providers.get(details.source.providerKey)
    if (!provider) throw new PublisherVerificationError('unsupported-target')
    const target = await provider.resolveTarget(input.url)
    if (
        !target ||
        target.source.providerKey !== details.source.providerKey ||
        target.source.externalId !== details.source.externalId ||
        target.method !== details.challenge.method
    )
        throw new PublisherVerificationError('target-mismatch')

    if (!(await provider.verify({ target, code: details.challenge.code })))
        throw new PublisherVerificationError('proof-not-found')

    const ownership = await input.repository.consumeChallengeAndCreateOwnership(
        details.challenge,
        now,
    )
    if (!ownership) throw new PublisherVerificationError('challenge-consumed')
    return ownership
}
