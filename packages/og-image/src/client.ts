import type { AvatioImageProps, IssueImageResponse } from './schema'

export interface RequestAvatioOgImageOptions {
    endpoint: string
    secret: string
    props: AvatioImageProps
    fetch?: typeof fetch
}

export const requestAvatioOgImage = async ({
    endpoint,
    secret,
    props,
    fetch: fetcher = fetch,
}: RequestAvatioOgImageOptions): Promise<string | undefined> => {
    const url = new URL('/v1/images/avatio/v1', endpoint)
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

export type { AvatioImageProps, IssueImageResponse } from './schema'
