import { readFileSync } from 'node:fs'

import { parseCloudflarePreviewDeployment } from '../config/cloudflarePreviewLifecycle.ts'

/** Read-only checks against the immutable deployment URL, without cookies or response logging. */
export const verifyCloudflarePreviewHttp = async (
    input: unknown,
    expected: { mode: string; siteUrl: string },
    fetcher: typeof fetch = fetch,
) => {
    const deployment = parseCloudflarePreviewDeployment(input, expected)
    const request = async (path: string) => {
        const response = await fetcher(new URL(path, deployment.deploymentUrl), {
            method: 'GET',
            redirect: 'error',
            cache: 'no-store',
            signal: AbortSignal.timeout(10_000),
        })
        if (response.status !== 200)
            throw new Error(`Preview verification failed at ${path} (HTTP ${response.status}).`)
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
    return { ...deployment, httpVerified: true as const, realBindingsVerified: false as const }
}

// Explicit read-only operator/Actions entry point; no .env, credentials or real inventory reads.
if (import.meta.main) {
    const [resultPath, mode, siteUrl, ...extra] = process.argv.slice(2)
    try {
        if (!resultPath || !mode || !siteUrl || extra.length)
            throw new Error('Expected: <cf-result.json> <Preview name> <reviewed stable origin>.')
        const verified = await verifyCloudflarePreviewHttp(
            JSON.parse(readFileSync(resultPath, 'utf8')),
            { mode, siteUrl },
        )
        console.info(
            JSON.stringify({
                mode,
                httpVerified: verified.httpVerified,
                realBindingsVerified: false,
            }),
        )
    } catch {
        // The cf result can contain private deployment identifiers; never echo it on failure.
        console.error(
            'Preview verification failed. Inspect the private result and target; no cutover is permitted.',
        )
        process.exitCode = 1
    }
}
