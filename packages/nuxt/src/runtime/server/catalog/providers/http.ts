import type { PublisherSourceId, PublisherSourceSnapshot } from '@avatio/core/publishers'

export interface ProviderHttpResponse<T> {
    status: number
    ok: boolean
    data: T | null
}

export interface ProviderHttpClient {
    get<T>(url: string): Promise<ProviderHttpResponse<T>>
}

export type ResolvePublisherSource = (
    snapshot: PublisherSourceSnapshot,
) => Promise<PublisherSourceId>

export const isConfirmedWithdrawalStatus = (status: number) => status === 404 || status === 410

export const withdrawalErrorKind = (status: number) =>
    status === 410 ? 'provider-gone' : 'provider-not-found'
