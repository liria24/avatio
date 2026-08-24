import type { CatalogProvider, ExternalReference, ProviderFetchResult } from '@avatio/core/catalog'
import {
    isGithubRepositoryId,
    matchGithubCatalogUrl,
} from '@avatio/nuxt/runtime/catalog/references'

import type { ProviderHttpClient, ProviderHttpResponse } from './http'
import { isConfirmedWithdrawalStatus, withdrawalErrorKind } from './http'

interface GithubRepoResponse {
    repo: {
        name: string
        repo: string
        description: string
        stars: number
        forks: number
    }
}

interface GithubContributorsResponse {
    contributors: { username: string; contributions: number }[]
}

interface GithubLatestReleaseResponse {
    release: { tag: string }
}

interface GithubReadmeResponse {
    markdown: string
}

export interface GithubProviderOptions {
    http: ProviderHttpClient
    apiBaseUrl?: string
}

const optionalData = <T>(result: PromiseSettledResult<ProviderHttpResponse<T>>) =>
    result.status === 'fulfilled' && result.value.ok ? result.value.data : null

export class GithubCatalogProvider implements CatalogProvider {
    readonly key = 'github'
    readonly #apiBaseUrl: string

    constructor(private readonly options: GithubProviderOptions) {
        this.#apiBaseUrl = options.apiBaseUrl ?? 'https://ungh.cc/'
    }

    matchUrl(url: URL): ExternalReference | null {
        return matchGithubCatalogUrl(url)
    }

    async fetch(reference: ExternalReference): Promise<ProviderFetchResult> {
        if (reference.providerKey !== this.key || !isGithubRepositoryId(reference.externalId))
            return { status: 'transient_error', errorKind: 'provider-reference-mismatch' }

        const repositoryUrl = new URL(`repos/${reference.externalId}`, this.#apiBaseUrl).href
        let repositoryResponse: ProviderHttpResponse<GithubRepoResponse>
        try {
            repositoryResponse = await this.options.http.get<GithubRepoResponse>(repositoryUrl)
        } catch {
            return { status: 'transient_error', errorKind: 'provider-network-error' }
        }

        if (isConfirmedWithdrawalStatus(repositoryResponse.status))
            return {
                status: 'withdrawn',
                errorKind: withdrawalErrorKind(repositoryResponse.status),
            }
        if (!repositoryResponse.ok)
            return {
                status: 'transient_error',
                errorKind: `provider-http-${repositoryResponse.status}`,
            }
        if (!repositoryResponse.data?.repo)
            return { status: 'transient_error', errorKind: 'provider-invalid-success-response' }

        const [contributorsResult, releaseResult, readmeResult] = await Promise.allSettled([
            this.options.http.get<GithubContributorsResponse>(`${repositoryUrl}/contributors`),
            this.options.http.get<GithubLatestReleaseResponse>(`${repositoryUrl}/releases/latest`),
            this.options.http.get<GithubReadmeResponse>(`${repositoryUrl}/readme`),
        ])
        const contributors = optionalData(contributorsResult)
        const release = optionalData(releaseResult)
        const readme = optionalData(readmeResult)
        const repository = repositoryResponse.data.repo
        const owner = repository.repo.split('/')[0]
        if (!owner)
            return { status: 'transient_error', errorKind: 'provider-invalid-success-response' }

        return {
            status: 'available',
            snapshot: {
                reference: {
                    providerKey: this.key,
                    externalId: repository.repo,
                    canonicalUrl: `https://github.com/${repository.repo}`,
                },
                name: repository.name,
                image: null,
                price: null,
                popularityCount: repository.stars,
                nsfw: false,
                category: {
                    rawKey: 'github-repository',
                    rawLabel: 'GitHub repository',
                    mappedCategory: null,
                },
                metadata: {
                    description: repository.description || '',
                    forks: repository.forks,
                    version: release?.release.tag,
                    readme: readme?.markdown || '',
                    contributors:
                        contributors?.contributors
                            .toSorted((left, right) => right.contributions - left.contributions)
                            .map(({ username, contributions }) => ({
                                name: username,
                                contributions,
                            })) ?? [],
                },
                publisher: {
                    externalId: owner,
                    canonicalUrl: `https://github.com/${owner}`,
                    name: owner,
                    image: `https://github.com/${owner}.png`,
                    providerVerified: false,
                    metadata: {},
                },
            },
        }
    }
}
