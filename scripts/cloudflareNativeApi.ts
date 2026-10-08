import { isDeepStrictEqual } from 'node:util'

import { z } from 'zod'

import {
    createCloudflareConfig,
    getCloudflareTargetResources,
    getCloudflareDevelopmentInspectionConfiguration,
    type CloudflareResourceInventory,
} from '../config/cloudflare.ts'
import { developmentSchemaSql, developmentLedgerSql } from './cloudflareDevelopmentLedger.ts'
import {
    NativeHttpError,
    NativeDiagnosticError,
    type NativeReporter,
} from './cloudflareNativeDiagnostics.ts'

const record = (value: unknown): Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {}
const previewIdentity = z.object({
    id: z.string().regex(/^[\w-]+$/),
    name: z.string(),
    slug: z.string(),
})

const isObject = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value)
const present = (value: Record<string, unknown>, name: string) => Object.hasOwn(value, name)

/** The upstream DeploymentResource fields, projected before normalization; no values or arbitrary keys. */
const deploymentShape = (raw: unknown) => {
    const value = record(raw)
    return {
        deploymentObject: isObject(raw),
        idPresent: present(value, 'id'),
        idString: typeof value.id === 'string',
        idValidIdentifier: typeof value.id === 'string' && /^[\w-]+$/.test(value.id),
        previewIdPresent: present(value, 'preview_id'),
        previewIdString: typeof value.preview_id === 'string',
        previewIdValidIdentifier:
            typeof value.preview_id === 'string' && /^[\w-]+$/.test(value.preview_id),
        previewNamePresent: present(value, 'preview_name'),
        previewNameString: typeof value.preview_name === 'string',
        urlsPresent: present(value, 'urls'),
        urlsArray: Array.isArray(value.urls),
        urlsNonEmpty: Array.isArray(value.urls) && value.urls.length > 0,
        urlsStrings:
            Array.isArray(value.urls) && value.urls.every((url) => typeof url === 'string'),
        envPresent: present(value, 'env'),
        envObject: isObject(value.env),
        annotationsPresent: present(value, 'annotations'),
        annotationsObject: isObject(value.annotations),
    }
}

/** Project only reviewed binding fields; never retain API extensions or secret payloads. */
const sanitizePreviewDeployment = (raw: unknown) => {
    const value = record(raw)
    const keys = [
        'type',
        'text',
        'database_id',
        'namespace_id',
        'bucket_name',
        'queue_name',
        'id',
        'app_id',
        'simple',
        'allowed_sender_addresses',
        'allowed_destination_addresses',
    ]
    const env = Object.fromEntries(
        Object.entries(record(value.env)).map(([name, binding]) => {
            const item = record(binding)
            return [
                name,
                item.type === 'secret_text' ||
                item.type === 'secret' ||
                // Retired signing-name values are still sensitive when inspecting historical deployments.
                ['BETTER_AUTH_SECRET', 'NUXT_BETTER_AUTH_SECRET', 'TWITTER_CLIENT_SECRET'].includes(
                    name,
                )
                    ? { type: item.type }
                    : Object.fromEntries(
                          keys
                              .filter(
                                  (key) =>
                                      key in item && (key !== 'text' || item.type === 'plain_text'),
                              )
                              .map((key) => [key, item[key]]),
                      ),
            ]
        }),
    )
    return {
        id: value.id,
        preview_id: value.preview_id,
        preview_name: value.preview_name,
        urls: value.urls,
        sourceSha: record(value.annotations)['workers/commit_sha'],
        env,
    }
}

/** Thin beta REST calls used by the pinned official Preview implementation. Never log responses. */
export const createCloudflareNativeApi = (
    accountId: string,
    token: string,
    fetcher: typeof fetch = fetch,
    inspection?: { databaseId: string; bucket: string },
    reportDiagnostic?: NativeReporter,
    inspectionBindingNames?: readonly string[],
) => {
    if (!/^[a-f0-9]{32}$/.test(accountId) || !token)
        throw new Error('Explicit account and credential required.')
    const request = async (
        path: string,
        method = 'GET',
        body?: unknown,
        absent = false,
        responseKind?: 'preview-deployment',
    ): Promise<unknown> => {
        if (inspection) {
            const reads = [
                previewPath('development'),
                `/d1/database/${inspection.databaseId}`,
                `/r2/buckets/${encodeURIComponent(inspection.bucket)}`,
            ]
            const queryBody = record(body)
            const sql = queryBody.sql
            const readQuery =
                method === 'POST' &&
                path === `/d1/database/${inspection.databaseId}/query` &&
                (sql === developmentSchemaSql || sql === developmentLedgerSql) &&
                Array.isArray(queryBody.params) &&
                queryBody.params.length === 0
            const read =
                method === 'GET' &&
                (reads.includes(path) ||
                    /^\/storage\/kv\/namespaces\?per_page=100&page=[1-9]\d*$/.test(path) ||
                    /^\/workers\/workers\/avatio\/previews\/development\/deployments\/[\w-]+$/.test(
                        path,
                    ))
            if (!read && !readQuery)
                throw new Error('Inspection permits reviewed development metadata reads only.')
        }
        let response: Response
        try {
            response = await fetcher(
                `https://api.cloudflare.com/client/v4/accounts/${accountId}${path}`,
                {
                    method,
                    redirect: 'error',
                    signal: AbortSignal.timeout(30_000),
                    headers: {
                        authorization: `Bearer ${token}`,
                        'content-type': 'application/json',
                    },
                    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
                },
            )
        } catch (cause) {
            throw new NativeDiagnosticError(
                'api-transport-failed',
                {
                    responseShape: { httpResponseReceived: false, jsonParsed: false },
                },
                cause,
            )
        }
        if (
            response.url &&
            response.url !== `https://api.cloudflare.com/client/v4/accounts/${accountId}${path}`
        )
            throw new NativeDiagnosticError('api-response-scope-mismatch', {
                responseShape: { httpResponseReceived: true },
            })
        // A 403, transport failure, or unsuccessful envelope is never resource absence.
        if (absent && response.status === 404) {
            if (responseKind)
                reportDiagnostic?.({
                    phase: 'preview-api-response',
                    outcome: 'verified',
                    httpStatus: 404,
                    evidence: { deploymentPresent: false },
                })
            return null
        }
        if (!response.ok) {
            // Bound the body before parsing; never retain or report provider messages/secret echoes.
            const reader = response.body?.getReader()
            const chunks: Uint8Array[] = []
            let length = 0,
                withinLimit = true,
                parsed = false
            let codes: number[] = []
            try {
                if (reader)
                    while (true) {
                        const item = await reader.read()
                        if (item.done) break
                        length += item.value.byteLength
                        if (length > 16_384) {
                            withinLimit = false
                            await reader.cancel()
                            break
                        }
                        chunks.push(item.value)
                    }
                if (withinLimit) {
                    const bytes = new Uint8Array(length)
                    let offset = 0
                    for (const chunk of chunks) {
                        bytes.set(chunk, offset)
                        offset += chunk.byteLength
                    }
                    const value = record(JSON.parse(new TextDecoder().decode(bytes)))
                    parsed = true
                    if (Array.isArray(value.errors))
                        codes = [
                            ...new Set(
                                value.errors
                                    .slice(0, 8)
                                    .map((error: unknown) => record(error).code)
                                    .filter(
                                        (code: unknown): code is number =>
                                            typeof code === 'number' &&
                                            Number.isInteger(code) &&
                                            code >= 0 &&
                                            code <= 999_999,
                                    ),
                            ),
                        ]
                }
            } catch {
                /* A malformed/failed error body must not hide the HTTP failure. */
            } finally {
                reader?.releaseLock()
            }
            throw new NativeHttpError(response.status, {
                jsonParsed: parsed,
                bodyWithinLimit: withinLimit,
                codes,
                classification: codes.includes(10025)
                    ? 'preview-not-found'
                    : codes.includes(10222)
                      ? 'deployment-not-found'
                      : codes.includes(10032)
                        ? 'deployment-not-patchable'
                        : 'unclassified',
            })
        }
        let rawEnvelope: unknown
        try {
            rawEnvelope = await response.json()
        } catch (cause) {
            throw new NativeDiagnosticError(
                'api-json-invalid',
                {
                    responseShape: { httpResponseReceived: true, jsonParsed: false },
                },
                cause,
                response.status,
            )
        }
        const envelope = record(rawEnvelope)
        const shape = {
            httpResponseReceived: true,
            jsonParsed: true,
            envelopeObject: isObject(rawEnvelope),
            successPresent: present(envelope, 'success'),
            successBoolean: typeof envelope.success === 'boolean',
            successTrue: envelope.success === true,
            resultPresent: present(envelope, 'result'),
            resultObject: isObject(envelope.result),
            resultArray: Array.isArray(envelope.result),
            resultNull: envelope.result === null,
            ...(responseKind ? deploymentShape(envelope.result) : {}),
        }
        if (responseKind)
            reportDiagnostic?.({
                phase: 'preview-api-response',
                outcome: 'started',
                httpStatus: response.status,
                evidence: { responseShape: shape },
            })
        if (!shape.envelopeObject || !shape.successBoolean)
            throw new NativeDiagnosticError(
                'api-envelope-shape',
                { responseShape: shape },
                undefined,
                response.status,
            )
        if (!shape.successTrue)
            throw new NativeDiagnosticError(
                'api-envelope-rejected',
                { responseShape: shape },
                undefined,
                response.status,
            )
        if (!shape.resultPresent)
            throw new NativeDiagnosticError(
                'api-result-missing',
                { responseShape: shape },
                undefined,
                response.status,
            )
        if (responseKind && !shape.resultObject)
            throw new NativeDiagnosticError(
                'api-deployment-shape',
                { responseShape: shape },
                undefined,
                response.status,
            )
        return envelope.result
    }
    const previewPath = (mode: string) => {
        if (!/^(development|pr-[1-9]\d*)$/.test(mode))
            throw new Error('Invalid native Preview target.')
        return `/workers/workers/avatio/previews/${mode}`
    }
    const preview = async (mode: string) => {
        const value = await request(previewPath(mode), 'GET', undefined, true)
        if (value === null) return null
        const parsed = previewIdentity.parse(value)
        if (parsed.name !== mode || parsed.slug !== mode)
            throw new Error('Preview ownership mismatch.')
        return parsed
    }
    // Official GET/PATCH deployment endpoints are account/worker/Preview scoped. Actual beta
    // https://github.com/cloudflare/workers-sdk/blob/main/packages/deploy-helpers/src/preview/api.ts
    // Responses can omit the interface's preview_id/name: never treat omission as a conflict,
    // and never accept it without fresh, matching Preview identities around exact-ID reads.
    const scopedDeployment = async (
        mode: string,
        version: string,
        absent = false,
        expectedPreviewId?: string,
    ) => {
        if (!/^[\w-]+$/.test(version)) throw new Error('Exact Preview version required.')
        const before = await preview(mode)
        if (!before || (expectedPreviewId !== undefined && before.id !== expectedPreviewId))
            throw new NativeDiagnosticError('preview-parent-id-mismatch', { parentMatches: false })
        const associate = (raw: unknown, exactId?: string) => {
            const value = record(raw)
            if (typeof value.id !== 'string' || !/^[\w-]+$/.test(value.id) || value.id === 'latest')
                throw new NativeDiagnosticError('preview-deployment-id-invalid', {
                    deploymentIdValid: false,
                })
            if (
                !inspection &&
                (!Array.isArray(value.urls) ||
                    !value.urls.length ||
                    !value.urls.every((url) => typeof url === 'string'))
            )
                throw new NativeDiagnosticError('preview-url-contract-mismatch')
            if (!inspection && present(value, 'env') && !isObject(value.env))
                throw new NativeDiagnosticError('preview-bindings-mismatch', {
                    bindingsVerified: false,
                })
            if (present(value, 'preview_id') && value.preview_id !== before.id)
                throw new NativeDiagnosticError('preview-parent-id-mismatch', {
                    parentMatches: false,
                })
            if (present(value, 'preview_name') && value.preview_name !== before.name)
                throw new NativeDiagnosticError('preview-name-mismatch', {
                    previewNameMatches: false,
                })
            if (exactId !== undefined && value.id !== exactId)
                throw new NativeDiagnosticError('preview-exact-id-mismatch', {
                    exactIdMatches: false,
                })
            // Internal normalized identity comes from the verified endpoint association,
            // not from unreported wire fields; their original presence remains in diagnostics.
            return {
                ...sanitizePreviewDeployment(raw),
                ...(inspection && inspectionBindingNames
                    ? {
                          wireEnvEvidence: {
                              object: isObject(value.env),
                              entryCount: Math.min(Object.keys(record(value.env)).length, 256),
                              truncated: Object.keys(record(value.env)).length > 256,
                              bindingsContainerObject: isObject(record(value.env).bindings),
                              bindingsContainerArray: Array.isArray(record(value.env).bindings),
                              varsContainerObject: isObject(record(value.env).vars),
                              secretsContainerObject: isObject(record(value.env).secrets),
                              names: Object.fromEntries(
                                  inspectionBindingNames.map((name) => {
                                      const item = record(record(value.env)[name])
                                      const kinds = [
                                          'plain_text',
                                          'json',
                                          'secret_text',
                                          'secret',
                                          'text',
                                          'd1',
                                          'kv_namespace',
                                          'kv',
                                          'r2',
                                          'rate-limit',
                                          'send-email',
                                          'r2_bucket',
                                          'assets',
                                          'flagship',
                                          'ratelimit',
                                          'send_email',
                                          'ai',
                                          'images',
                                          'queue',
                                      ]
                                      return [
                                          name,
                                          {
                                              present: present(record(value.env), name),
                                              object: isObject(record(value.env)[name]),
                                              entryShape: !present(record(value.env), name)
                                                  ? 'absent'
                                                  : record(value.env)[name] === null
                                                    ? 'null'
                                                    : Array.isArray(record(value.env)[name])
                                                      ? 'array'
                                                      : typeof record(value.env)[name],
                                              valuePresent: present(item, 'value'),
                                              valueObject: isObject(item.value),
                                              textPresent: present(item, 'text'),
                                              fields: Object.fromEntries(
                                                  [
                                                      'database_id',
                                                      'namespace_id',
                                                      'bucket_name',
                                                      'id',
                                                      'app_id',
                                                      'simple',
                                                      'allowed_sender_addresses',
                                                      'allowed_destination_addresses',
                                                  ].map((key) => [key, present(item, key)]),
                                              ),
                                              typePresent: present(item, 'type'),
                                              typeString: typeof item.type === 'string',
                                              fixedType:
                                                  typeof item.type === 'string' &&
                                                  kinds.includes(item.type)
                                                      ? item.type
                                                      : 'unrecognized-or-absent',
                                          },
                                      ]
                                  }),
                              ),
                          },
                      }
                    : {}),
                id: value.id,
                preview_id: before.id,
                preview_name: before.name,
            }
        }
        const path = `${previewPath(mode)}/deployments/`
        const raw = await request(
            `${path}${version}`,
            'GET',
            undefined,
            absent,
            'preview-deployment',
        )
        let result =
            raw === null ? null : associate(raw, version !== 'latest' ? version : undefined)
        if (result && version === 'latest') {
            const exact = associate(
                await request(`${path}${result.id}`, 'GET', undefined, false, 'preview-deployment'),
                result.id,
            )
            if (
                !isDeepStrictEqual(result.urls, exact.urls) ||
                (result.sourceSha !== undefined && result.sourceSha !== exact.sourceSha) ||
                !isDeepStrictEqual(result.env, exact.env)
            )
                throw new NativeDiagnosticError('preview-deployment-receipt-mismatch')
            result = exact
        }
        const after = await preview(mode)
        const stable =
            after !== null &&
            before.id === after.id &&
            before.name === after.name &&
            before.slug === after.slug
        if (!stable)
            throw new NativeDiagnosticError('preview-parent-changed', {
                parentMatches: false,
                previewParentStable: false,
            })
        reportDiagnostic?.({
            phase: 'preview-endpoint-association',
            outcome: 'verified',
            evidence: {
                parentMatches: true,
                previewParentStable: true,
                deploymentPresent: result !== null,
                endpointAssociationVerified: true,
            },
        })
        return result === null
            ? null
            : { ...result, parentAssociation: 'verified-preview-endpoint' as const }
    }
    const inspect = async (mode: string, inventory: CloudflareResourceInventory) => {
        if (inspection && mode !== 'development')
            throw new Error('Only development metadata inspection is allowed.')
        const target = inspection
            ? getCloudflareDevelopmentInspectionConfiguration(inventory).resources
            : (createCloudflareConfig({ mode, isPreview: mode !== 'production' }, inventory),
              getCloudflareTargetResources(mode, inventory))
        if (!target || inventory.accountId !== accountId)
            throw new Error('Missing reviewed target.')
        const database = await request(`/d1/database/${target.database.id}`, 'GET', undefined, true)
        const cache = (await namespaces()).find((value) => value.id === target.cache.id) ?? null
        const bucket = await request(
            `/r2/buckets/${encodeURIComponent(target.bucket)}`,
            'GET',
            undefined,
            true,
        )
        // Project only identity fields; responses can contain private settings.
        return {
            accountId,
            workerName: 'avatio' as const,
            complete: true as const,
            resources: {
                ...(mode === 'production' ? {} : { preview: await preview(mode) }),
                database:
                    database === null
                        ? null
                        : { id: record(database).uuid, name: record(database).name },
                cache: cache === null ? null : { id: record(cache).id, name: record(cache).title },
                bucket: bucket === null ? null : { name: record(bucket).name },
            },
        }
    }
    const namespaces = async () => {
        const values: Record<string, unknown>[] = []
        for (let page = 1; page <= 100; page++) {
            const rows = await request(`/storage/kv/namespaces?per_page=100&page=${page}`)
            if (!Array.isArray(rows)) throw new Error('KV enumeration is incomplete.')
            values.push(...rows.map(record))
            if (rows.length < 100) return values
        }
        throw new Error('KV enumeration exceeded bounded pagination.')
    }
    const query = async (databaseId: string, sql: string, params: string[] = []) => {
        if (!z.uuid().safeParse(databaseId).success) throw new Error('Exact D1 ID required.')
        const results = await request(`/d1/database/${databaseId}/query`, 'POST', { sql, params })
        if (
            !Array.isArray(results) ||
            results.length !== 1 ||
            record(results[0]).success !== true ||
            !Array.isArray(record(results[0]).results)
        )
            throw new Error('D1 query did not succeed.')
        if (inspection && record(record(results[0]).meta).rows_written !== 0)
            throw new Error('Read-only D1 query did not confirm zero written rows.')
        return record(results[0]).results as unknown[]
    }
    return {
        inspect,
        query,
        preview,
        async previewBaseBindings() {
            const worker = record(await request('/workers/workers/avatio'))
            const base = record(worker.previews_base_config)
            if (!isObject(base.env)) throw new Error('Preview Base settings are unavailable.')
            return sanitizePreviewDeployment({ env: base.env }).env
        },
        async previewDeployment(
            mode: string,
            version: string,
            allowUndeployed = false,
            expectedPreviewId?: string,
        ) {
            return scopedDeployment(mode, version, allowUndeployed, expectedPreviewId)
        },
        async deletePreview(mode: string, expectedId: string) {
            if (!/^pr-[1-9]\d*$/.test(mode)) throw new Error('Only PR Previews can be deleted.')
            const current = await preview(mode)
            if (!current) return
            if (current.id !== expectedId)
                throw new Error('Preview was replaced; deletion refused.')
            await request(`${previewPath(mode)}`, 'DELETE')
            if (await preview(mode)) throw new Error('Preview deletion remains unverified.')
        },
    }
}

/** Compare every expected Preview binding and reject production inheritance/extra integrations. */
export const verifyCloudflarePreviewBindings = (
    input: unknown,
    expected: ReturnType<typeof createCloudflareConfig>['worker']['env'],
    identity: { mode: string; deploymentId: string },
) => {
    const deployment = record(input)
    const env = record(deployment.env)
    if (
        deployment.id !== identity.deploymentId ||
        deployment.preview_name !== identity.mode ||
        Object.keys(env).length !== Object.keys(expected).length
    )
        throw new Error('Preview version identity or complete binding set differs.')
    for (const [name, binding] of Object.entries(expected)) {
        const actual = record(env[name])
        if (binding.type === 'text') {
            if (actual.type !== 'plain_text' || actual.text !== binding.value)
                throw new Error('Preview runtime text binding differs.')
        } else if (binding.type === 'secret') {
            if (actual.type !== 'secret_text') throw new Error('Preview runtime secret is missing.')
        } else {
            const types: Record<string, string> = {
                d1: 'd1',
                kv: 'kv_namespace',
                r2: 'r2_bucket',
                assets: 'assets',
                flagship: 'flagship',
                'rate-limit': 'ratelimit',
                'send-email': 'send_email',
                ai: 'ai',
                images: 'images',
                queue: 'queue',
            }
            if (actual.type !== types[binding.type])
                throw new Error('Preview runtime binding type differs.')
            if (binding.type === 'd1' && actual.database_id !== binding.id)
                throw new Error('Preview D1 identity differs.')
            if (binding.type === 'kv' && actual.namespace_id !== binding.id)
                throw new Error('Preview KV identity differs.')
            if (binding.type === 'r2' && actual.bucket_name !== binding.name)
                throw new Error('Preview R2 identity differs.')
            if (binding.type === 'queue' && actual.queue_name !== binding.name)
                throw new Error('Queue identity differs.')
            if (
                binding.type === 'flagship' &&
                actual.id !== binding.id &&
                actual.app_id !== binding.id
            )
                throw new Error('Preview Flagship identity differs.')
            if (
                binding.type === 'rate-limit' &&
                (actual.namespace_id !== binding.namespace ||
                    JSON.stringify(actual.simple) !== JSON.stringify(binding.simple))
            )
                throw new Error('Preview rate limit differs.')
            if (
                binding.type === 'send-email' &&
                (JSON.stringify(actual.allowed_sender_addresses) !==
                    JSON.stringify(binding.allowedSenderAddresses) ||
                    JSON.stringify(actual.allowed_destination_addresses) !==
                        JSON.stringify(binding.allowedDestinationAddresses))
            )
                throw new Error('Preview email restrictions differ.')
        }
    }
    return { realBindingsVerified: true as const }
}
