import { isDeepStrictEqual } from 'node:util'

import {
    getCloudflareDevelopmentInspectionConfiguration,
    type CloudflareResourceInventory,
} from '../config/cloudflare.ts'
import { developmentSchemaSql, developmentLedgerSql } from './cloudflareDevelopmentLedger.ts'
import { NativeDiagnosticError, NativeHttpError } from './cloudflareNativeDiagnostics.ts'
import { inspectCloudflarePreviewMetadata } from './cloudflarePreviewMetadata.ts'

const record = (value: unknown): Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {}
const identifier = /^[\w-]{1,128}$/
const previewPath = '/workers/workers/avatio/previews/development'

/** Temporary, read-only boundary for the existing development Preview. No publisher API. */
export const createCloudflareNativeApi = (
    inventory: CloudflareResourceInventory,
    token: string,
    fetcher: typeof fetch = fetch,
) => {
    const { configuration, resources } = (() => {
        try {
            return getCloudflareDevelopmentInspectionConfiguration(inventory)
        } catch {
            throw new NativeDiagnosticError('operation-failed')
        }
    })()
    const accountId = configuration.accountId
    if (!token) throw new NativeDiagnosticError('operation-failed')
    const request = async (
        path: string,
        sql?: typeof developmentSchemaSql | typeof developmentLedgerSql,
        absent = false,
    ) => {
        const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}${path}`
        let response: Response
        try {
            response = await fetcher(url, {
                method: sql === undefined ? 'GET' : 'POST',
                redirect: 'error',
                signal: AbortSignal.timeout(30_000),
                headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
                ...(sql === undefined ? {} : { body: JSON.stringify({ sql, params: [] }) }),
            })
        } catch {
            throw new NativeDiagnosticError('api-transport-failed')
        }
        if (response.url && response.url !== url)
            throw new NativeDiagnosticError('api-response-scope-mismatch')
        if (absent && response.status === 404) return null
        if (!response.ok) throw new NativeHttpError(response.status)
        let envelope: Record<string, unknown>
        try {
            envelope = record(await response.json())
        } catch {
            throw new NativeDiagnosticError('api-response-invalid')
        }
        if (envelope.success !== true || !Object.hasOwn(envelope, 'result'))
            throw new NativeDiagnosticError('api-response-invalid')
        return envelope.result
    }
    const preview = async () => {
        const raw = await request(previewPath, undefined, true)
        if (raw === null) return null
        const value = record(raw)
        if (
            typeof value.id !== 'string' ||
            !identifier.test(value.id) ||
            value.name !== 'development' ||
            value.slug !== 'development'
        )
            throw new NativeDiagnosticError('preview-parent-mismatch')
        return { id: value.id, name: 'development' as const }
    }
    const deployment = async (version: string, expectedPreviewId: string, reviewedUrl?: string) => {
        if (!identifier.test(version) || !identifier.test(expectedPreviewId))
            throw new NativeDiagnosticError('preview-deployment-mismatch')
        const before = await preview()
        if (before?.id !== expectedPreviewId)
            throw new NativeDiagnosticError('preview-parent-mismatch')
        const read = async (id: string) => {
            const raw = await request(
                `${previewPath}/deployments/${id}`,
                undefined,
                id === 'latest',
            )
            if (raw === null) return null
            const value = record(raw)
            if (
                typeof value.id !== 'string' ||
                !identifier.test(value.id) ||
                value.id === 'latest' ||
                (id !== 'latest' && value.id !== id)
            )
                throw new NativeDiagnosticError('preview-deployment-mismatch')
            if (
                (Object.hasOwn(value, 'preview_id') && value.preview_id !== expectedPreviewId) ||
                (Object.hasOwn(value, 'preview_name') && value.preview_name !== 'development')
            )
                throw new NativeDiagnosticError('preview-parent-mismatch')
            const source = record(value.annotations)['workers/commit_sha']
            return {
                id: value.id,
                previewId: expectedPreviewId,
                sourceAnnotationPresent: source !== undefined,
                sourceSha:
                    typeof source === 'string' && /^[a-f0-9]{40}$/.test(source)
                        ? source
                        : undefined,
                reviewedUrlPresent:
                    reviewedUrl !== undefined &&
                    Array.isArray(value.urls) &&
                    value.urls.includes(reviewedUrl),
                ...inspectCloudflarePreviewMetadata(value.env, configuration.worker.env),
            }
        }
        let result = await read(version)
        if (result && version === 'latest') {
            const exact = await read(result.id)
            if (!isDeepStrictEqual(result, exact))
                throw new NativeDiagnosticError('preview-deployment-mismatch')
            result = exact
        }
        if ((await preview())?.id !== before.id)
            throw new NativeDiagnosticError('preview-parent-changed')
        return result
    }
    const inspect = async () => {
        const database = record(await request(`/d1/database/${resources.database.id}`))
        const bucket = record(await request(`/r2/buckets/${encodeURIComponent(resources.bucket)}`))
        let cacheMatches = 0
        for (let page = 1; page <= 100; page++) {
            const raw = await request(`/storage/kv/namespaces?per_page=100&page=${page}`)
            if (!Array.isArray(raw) || raw.length > 100)
                throw new NativeDiagnosticError('api-response-invalid')
            cacheMatches += raw.filter((item) => {
                const cache = record(item)
                return cache.id === resources.cache.id && cache.title === resources.cache.name
            }).length
            if (raw.length < 100) break
            if (page === 100) throw new NativeDiagnosticError('api-response-invalid')
        }
        if (
            database.uuid !== resources.database.id ||
            database.name !== resources.database.name ||
            bucket.name !== resources.bucket ||
            cacheMatches !== 1
        )
            throw new NativeDiagnosticError('api-response-invalid')
        return { preview: await preview(), resourcesVerified: true as const }
    }
    const query = async (sql: string) => {
        if (sql !== developmentSchemaSql && sql !== developmentLedgerSql)
            throw new NativeDiagnosticError('operation-failed')
        const raw = await request(`/d1/database/${resources.database.id}/query`, sql)
        const result = record(Array.isArray(raw) && raw.length === 1 ? raw[0] : undefined)
        if (
            result.success !== true ||
            !Array.isArray(result.results) ||
            record(result.meta).rows_written !== 0
        )
            throw new NativeDiagnosticError('api-response-invalid')
        return result.results as unknown[]
    }
    return { inspect, preview, deployment, query }
}
