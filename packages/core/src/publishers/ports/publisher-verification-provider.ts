import type { PublisherSourceSnapshot } from '../domain/publisher'

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
