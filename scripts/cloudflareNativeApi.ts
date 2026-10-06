import { z } from 'zod'

import { createCloudflareConfig, type CloudflareResourceInventory } from '../config/cloudflare.ts'

const record = (value: unknown): Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {}
const previewIdentity = z.object({
    id: z.string().regex(/^[\w-]+$/),
    name: z.string(),
    slug: z.string(),
})

/** Thin beta REST calls used by the pinned official Preview implementation. Never log responses. */
export const createCloudflareNativeApi = (
    accountId: string,
    token: string,
    fetcher: typeof fetch = fetch,
) => {
    if (!/^[a-f0-9]{32}$/.test(accountId) || !token)
        throw new Error('Explicit account and credential required.')
    const request = async (
        path: string,
        method = 'GET',
        body?: unknown,
        absent = false,
    ): Promise<unknown> => {
        const response = await fetcher(
            `https://api.cloudflare.com/client/v4/accounts/${accountId}${path}`,
            {
                method,
                redirect: 'error',
                signal: AbortSignal.timeout(30_000),
                headers: {
                    authorization: `Bearer ${token}`,
                    'content-type':
                        method === 'PATCH' ? 'application/merge-patch+json' : 'application/json',
                },
                ...(body === undefined ? {} : { body: JSON.stringify(body) }),
            },
        )
        // A 403, transport failure, or unsuccessful envelope is never resource absence.
        if (absent && response.status === 404) return null
        if (!response.ok)
            throw new Error(
                `Cloudflare operation failed (HTTP ${response.status}); inspect privately.`,
            )
        const envelope = record(await response.json())
        if (envelope.success !== true || !('result' in envelope))
            throw new Error('Cloudflare operation was not confirmed.')
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
    const inspect = async (mode: string, inventory: CloudflareResourceInventory) => {
        createCloudflareConfig({ mode, isPreview: mode !== 'production' }, inventory)
        const target = mode.startsWith('pr-')
            ? inventory.previews?.[mode]
            : inventory[mode === 'production' ? 'production' : 'development']
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
        return record(results[0]).results as unknown[]
    }
    return {
        inspect,
        query,
        preview,
        async verifyProductionVersion(
            versionId: string,
            configuration: ReturnType<typeof createCloudflareConfig>,
        ) {
            if (
                !z.uuid().safeParse(versionId).success ||
                configuration.accountId !== accountId ||
                configuration.worker.name !== 'avatio'
            )
                throw new Error('Exact production version and reviewed account required.')
            const active = record(await request('/workers/scripts/avatio/deployments'))
            const deployments = active.deployments
            if (!Array.isArray(deployments))
                throw new Error('Active production deployment is unavailable.')
            const versions = record(deployments[0]).versions
            if (
                !Array.isArray(versions) ||
                versions.length !== 1 ||
                record(versions[0]).version_id !== versionId ||
                record(versions[0]).percentage !== 100
            )
                throw new Error('Production is not serving the exact published version.')
            const value = record(await request(`/workers/scripts/avatio/versions/${versionId}`))
            const resources = record(value.resources)
            const bindings = resources.bindings
            if (!Array.isArray(bindings))
                throw new Error('Specific version bindings are unavailable.')
            verifyCloudflarePreviewBindings(
                {
                    id: value.id,
                    preview_name: 'production',
                    env: Object.fromEntries(
                        bindings.map((binding) => [String(record(binding).name), record(binding)]),
                    ),
                },
                configuration.worker.env,
                { mode: 'production', deploymentId: versionId },
            )
            const runtime = record(resources.script_runtime)
            const flags = runtime.compatibility_flags
            if (
                runtime.compatibility_date !== configuration.worker.compatibilityDate ||
                !Array.isArray(flags) ||
                flags.includes('no_nodejs_compat_v2') ||
                configuration.worker.compatibilityFlags.some((flag) => !flags.includes(flag))
            )
                throw new Error('Production compatibility settings differ.')
            const schedules = record(await request('/workers/scripts/avatio/schedules')).schedules
            if (
                !Array.isArray(schedules) ||
                schedules.length !== 1 ||
                record(schedules[0]).cron !== '0 22 * * *'
            )
                throw new Error('Production Cron differs.')
            const queues = await request('/queues?per_page=100&page=1')
            if (!Array.isArray(queues) || queues.length >= 100)
                throw new Error('Queue enumeration is incomplete.')
            const expectedQueue = configuration.worker.env.ITEM_REVALIDATION_QUEUE
            if (expectedQueue?.type !== 'queue')
                throw new Error('Production Queue contract missing.')
            const matches = queues.filter(
                (queue) => record(queue).queue_name === expectedQueue.name,
            )
            if (matches.length !== 1 || typeof record(matches[0]).queue_id !== 'string')
                throw new Error('Production Queue identity is ambiguous.')
            const queueId = record(matches[0]).queue_id
            if (typeof queueId !== 'string') throw new Error('Exact Queue ID required.')
            const consumers = await request(`/queues/${queueId}/consumers`)
            if (!Array.isArray(consumers) || consumers.length !== 1)
                throw new Error('Production must have one Queue consumer.')
            const consumer = record(consumers[0])
            const settings = record(consumer.settings)
            if (
                consumer.script_name !== 'avatio' ||
                settings.batch_size !== 10 ||
                settings.max_wait_time_ms !== 5000 ||
                settings.max_retries !== 3
            )
                throw new Error('Production Queue consumer differs.')
            return { versionId, realBindingsVerified: true as const }
        },
        async rollbackProductionVersion(
            versionId: string,
            configuration: ReturnType<typeof createCloudflareConfig>,
        ) {
            if (!z.uuid().safeParse(versionId).success || configuration.accountId !== accountId)
                throw new Error('Reviewed prior Worker version required.')
            const previous = record(await request(`/workers/scripts/avatio/versions/${versionId}`))
            const bindings = record(previous.resources).bindings
            if (!Array.isArray(bindings)) throw new Error('Prior Worker bindings are unavailable.')
            verifyCloudflarePreviewBindings(
                {
                    id: previous.id,
                    preview_name: 'production',
                    env: Object.fromEntries(
                        bindings.map((binding) => [String(record(binding).name), record(binding)]),
                    ),
                },
                configuration.worker.env,
                { mode: 'production', deploymentId: versionId },
            )
            // Standard Worker deployment API. No Alchemy replay or D1 restore/query here.
            await request('/workers/scripts/avatio/deployments', 'POST', {
                strategy: 'percentage',
                versions: [{ version_id: versionId, percentage: 100 }],
                annotations: { 'workers/message': 'Reviewed Avatio Worker recovery; D1 retained' },
            })
        },
        async bootstrapPr(
            mode: string,
            sharedStorage: CloudflareResourceInventory['sharedPreviewStorage'],
        ) {
            if (!/^pr-[1-9]\d*$/.test(mode))
                throw new Error('Only dedicated PR resources may be created.')
            const name = `avatio-${mode}`
            const sharedDatabase = sharedStorage.database
            const named = async (path: string, key: string) => {
                const matches: Record<string, unknown>[] = []
                for (let page = 1; page <= 100; page++) {
                    const rows = await request(`${path}?per_page=100&page=${page}`)
                    if (!Array.isArray(rows))
                        throw new Error('Resource identity enumeration is incomplete.')
                    matches.push(...rows.map(record).filter((row) => row[key] === name))
                    if (matches.length > 1)
                        throw new Error('Duplicate PR resource names require operator inspection.')
                    if (rows.length < 100) return matches[0]
                }
                throw new Error('Resource enumeration exceeded its bounded pagination.')
            }
            // Enumerate first. A denied read never causes a replacement allocation.
            // Ordinary PRs bind existing shared D1 and R2; bootstrap never creates either.
            // Isolated PRs use a separately reviewed, explicitly provisioned storage pair.
            if (!z.uuid().safeParse(sharedDatabase.id).success || !sharedDatabase.name)
                throw new Error('A reviewed shared Preview D1 is required.')
            const database = record(await request(`/d1/database/${sharedDatabase.id}`))
            if (database.uuid !== sharedDatabase.id || database.name !== sharedDatabase.name)
                throw new Error('Shared Preview D1 identity mismatch.')
            const cache = await named('/storage/kv/namespaces', 'title')
            const bucket = record(
                await request(`/r2/buckets/${encodeURIComponent(sharedStorage.bucket)}`),
            )
            if (bucket.name !== sharedStorage.bucket)
                throw new Error('Shared Preview R2 identity mismatch.')
            const createdCache =
                cache ?? record(await request('/storage/kv/namespaces', 'POST', { title: name }))
            const result = {
                database: { id: database.uuid, name: database.name },
                cache: { id: createdCache.id, name: createdCache.title },
                bucket: bucket.name,
            }
            if (
                !z.uuid().safeParse(result.database.id).success ||
                result.database.name !== sharedDatabase.name ||
                !z
                    .string()
                    .regex(/^[a-f0-9]{32}$/)
                    .safeParse(result.cache.id).success ||
                result.cache.name !== name ||
                result.bucket !== sharedStorage.bucket
            )
                throw new Error(
                    'Allocated PR identities require private operator reconciliation; nothing is deleted.',
                )
            return result
        },
        async preparePreview(mode: string) {
            const existing = await preview(mode)
            if (existing) return existing
            // Preview Base is separate from production; avoid inheriting unreviewed Base settings.
            const created = previewIdentity.parse(
                await request('/workers/workers/avatio/previews?ignore_base_config=true', 'POST', {
                    name: mode,
                }),
            )
            if (created.name !== mode || created.slug !== mode)
                throw new Error('Created Preview identity mismatch.')
            return created
        },
        async previewDeployment(mode: string, version: string, allowUndeployed = false) {
            if (!/^[\w-]+$/.test(version)) throw new Error('Exact Preview version required.')
            const raw = await request(
                `${previewPath(mode)}/deployments/${version}`,
                'GET',
                undefined,
                allowUndeployed,
            )
            if (raw === null) return null
            const value = record(raw)
            // The API may echo secret values. Strip them before returning even to trusted callers.
            const env = Object.fromEntries(
                Object.entries(record(value.env)).map(([name, binding]) => {
                    const item = record(binding)
                    return [name, item.type === 'secret_text' ? { type: 'secret_text' } : item]
                }),
            )
            return { id: value.id, preview_name: value.preview_name, env }
        },
        async setPreviewSecrets(mode: string, version: string, secrets: Record<string, string>) {
            if (!/^[\w-]+$/.test(version)) throw new Error('Exact Preview version required.')
            // The documented cf deploy command has no secrets-file option for Previews.
            // Contain its upstream REST merge-patch alternative here, not in app/runtime code.
            await request(`${previewPath(mode)}/deployments/${version}`, 'PATCH', {
                env: Object.fromEntries(
                    Object.entries(secrets).map(([name, text]) => [
                        name,
                        { type: 'secret_text', text },
                    ]),
                ),
            })
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
        async deletePrResource(
            mode: string,
            kind: 'database' | 'cache' | 'bucket',
            inventory: CloudflareResourceInventory,
        ) {
            if (!/^pr-[1-9]\d*$/.test(mode)) throw new Error('Only PR resources can be deleted.')
            if (
                kind === 'database' &&
                inventory.previews?.[mode]?.database.id.toLowerCase() ===
                    inventory.sharedPreviewStorage.database.id.toLowerCase()
            )
                throw new Error('Shared Preview D1 must never be deleted during PR cleanup.')
            if (
                kind === 'bucket' &&
                inventory.previews?.[mode]?.bucket === inventory.sharedPreviewStorage.bucket
            )
                throw new Error('Shared Preview R2 must never be deleted during PR cleanup.')
            const observed = await inspect(mode, inventory)
            const target = inventory.previews?.[mode]
            if (!target) throw new Error('Missing reviewed PR resources.')
            const value = observed.resources[kind]
            if (value === null) return
            if (
                kind === 'database' &&
                (record(value).id !== target.database.id || record(value).name !== `avatio-${mode}`)
            )
                throw new Error('D1 ownership mismatch.')
            if (
                kind === 'cache' &&
                (record(value).id !== target.cache.id || record(value).name !== `avatio-${mode}`)
            )
                throw new Error('KV ownership mismatch.')
            if (kind === 'bucket' && record(value).name !== `avatio-${mode}`)
                throw new Error('R2 ownership mismatch.')
            const path =
                kind === 'database'
                    ? `/d1/database/${target.database.id}`
                    : kind === 'cache'
                      ? `/storage/kv/namespaces/${target.cache.id}`
                      : `/r2/buckets/${encodeURIComponent(target.bucket)}`
            // R2 deletion deliberately fails for a nonempty bucket. Never purge objects implicitly.
            await request(path, 'DELETE')
            if (
                kind === 'cache'
                    ? (await namespaces()).some((value) => value.id === target.cache.id)
                    : (await request(path, 'GET', undefined, true)) !== null
            )
                throw new Error('Resource deletion remains unverified.')
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
