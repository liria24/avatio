import type { IssueImageResponse } from './schema'

export interface RequestOgImageOptions<TProps = unknown> {
    endpoint: string
    secret: string
    preset: string
    version: string
    props: TProps
    fetch?: typeof fetch
}

export const requestOgImage = async ({
    endpoint,
    secret,
    preset,
    version,
    props,
    fetch: fetcher = fetch,
}: RequestOgImageOptions): Promise<string | undefined> => {
    const url = new URL(
        `/v1/images/${encodeURIComponent(preset)}/${encodeURIComponent(version)}`,
        endpoint,
    )
    const response = await fetcher(url, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
        },
        body: JSON.stringify({ secret, props }),
    })

    if (response.status !== 202) return undefined

    const body = (await response.json()) as Partial<IssueImageResponse>
    return typeof body.url === 'string' ? body.url : undefined
}

export type { IssueImageResponse } from './schema'
