import { NativeHttpError } from './cloudflareNativeDiagnostics.ts'

export const verifyCloudflareDeploymentHttp = async (
    origin: string,
    fetcher: typeof fetch = fetch,
) => {
    const target = new URL(origin)
    if (target.protocol !== 'https:' || origin !== target.origin)
        throw new Error('An exact HTTPS deployment origin is required.')
    const request = async (path: string) => {
        const response = await fetcher(new URL(path, origin), {
            method: 'GET',
            redirect: 'error',
            cache: 'no-store',
            signal: AbortSignal.timeout(10_000),
        })
        if (response.status !== 200) throw new NativeHttpError(response.status)
        return response
    }
    for (const path of ['/', '/en']) {
        const response = await request(path)
        const html = await response.text()
        if (
            !response.headers.get('content-type')?.includes('text/html') ||
            !html.includes('__nuxt') ||
            !/data-ssr=["']true["']/.test(html)
        )
            throw new Error(`Preview SSR verification failed at ${path}.`)
    }
    for (const path of ['/sw.js', '/manifest.webmanifest']) {
        const response = await request(path)
        if (!response.headers.get('cache-control')?.includes('must-revalidate'))
            throw new Error(`Preview PWA cache policy is missing at ${path}.`)
        if (path === '/manifest.webmanifest') await response.json()
        else if (!(await response.text()).length)
            throw new Error('Preview service worker is empty.')
    }
    // A unique query prevents an earlier cached catalog response masking an unavailable D1.
    const items = await request(`/api/items?limit=1&previewVerification=${crypto.randomUUID()}`)
    const result: unknown = await items.json()
    if (
        !result ||
        typeof result !== 'object' ||
        !('data' in result) ||
        !Array.isArray(result.data) ||
        !('pagination' in result) ||
        !items.headers.get('cache-control')?.includes('public')
    )
        throw new Error('Preview catalog/D1 HTTP contract verification failed.')
    const session = await request('/api/auth/get-session')
    if (
        !session.headers.get('cache-control')?.includes('no-store') ||
        (await session.json()) !== null
    )
        throw new Error('Preview anonymous session isolation verification failed.')
    return { httpVerified: true as const }
}

/** Inspection avoids auth/session and SSR paths: even anonymous session checks can write rate-limit rows. */
export const verifyCloudflareStaticDeploymentHttp = async (
    origin: string,
    fetcher: typeof fetch = fetch,
) => {
    const target = new URL(origin)
    if (target.protocol !== 'https:' || origin !== target.origin)
        throw new Error('An exact HTTPS deployment origin is required.')
    for (const path of ['/sw.js', '/manifest.webmanifest']) {
        const response = await fetcher(new URL(path, origin), {
            method: 'GET',
            redirect: 'error',
            cache: 'no-store',
            signal: AbortSignal.timeout(10_000),
        })
        if (response.status !== 200) throw new NativeHttpError(response.status)
        if (!response.headers.get('cache-control')?.includes('must-revalidate'))
            throw new Error('Immutable static HTTP inspection failed.')
        if (path === '/manifest.webmanifest') await response.json()
        else if (!(await response.text()).length)
            throw new Error('Preview service worker is empty.')
    }
    return { staticHttpVerified: true as const, applicationRuntimeVerified: false as const }
}

// Explicit smoke checks never receive signing secrets or deployment credentials.
if (import.meta.main) {
    try {
        const [origin, extra] = process.argv.slice(2)
        if (!origin || extra) throw new Error('An exact deployment origin is required.')
        console.info(JSON.stringify(await verifyCloudflareDeploymentHttp(origin)))
    } catch {
        console.error('Deployment smoke verification failed.')
        process.exitCode = 1
    }
}
