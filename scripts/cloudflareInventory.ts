// An opt-in inventory of existing resources. This script has no mutation or secret-value API.
type Metadata = Record<string, unknown>

const record = (value: unknown): Metadata =>
    typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Metadata) : {}
const array = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])
const strings = (value: unknown) =>
    array(value).filter((item): item is string => typeof item === 'string')
const fields = (value: unknown, keys: string[]) => {
    const input = record(value)
    return Object.fromEntries(
        keys.flatMap((key) => {
            const item = input[key]
            return typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean'
                ? [[key, item]]
                : []
        }),
    )
}

export const projectWorkerMetadata = (value: unknown) => {
    const input = record(value)
    return {
        ...fields(input, ['compatibility_date', 'logpush', 'tail_consumers']),
        compatibility_flags: strings(input.compatibility_flags),
        observability: {
            ...fields(input.observability, ['enabled', 'head_sampling_rate']),
            logs: fields(record(input.observability).logs, [
                'enabled',
                'invocation_logs',
                'head_sampling_rate',
                'persist',
            ]),
            traces: fields(record(input.observability).traces, ['enabled']),
        },
        bindings: array(input.bindings).map((binding) => {
            const item = record(binding)
            const identities: Record<string, string[]> = {
                d1: ['id', 'database_id'],
                kv_namespace: ['namespace_id'],
                r2_bucket: ['bucket_name'],
                queue: ['queue_name', 'queue_id'],
                flagship: ['app_id', 'id'],
                ratelimit: ['namespace_id'],
                service: ['service', 'environment'],
            }
            return {
                ...fields(item, [
                    'name',
                    'type',
                    ...(typeof item.type === 'string' && Object.hasOwn(identities, item.type)
                        ? (identities[item.type] ?? [])
                        : []),
                ]),
                ...(item.type === 'ratelimit'
                    ? { simple: fields(item.simple, ['limit', 'period']) }
                    : {}),
            }
        }),
    }
}

const resourceList = (value: unknown, nameKey: string, names: string[], keys: string[]) =>
    array(value)
        .filter((item) => {
            const name = record(item)[nameKey]
            return typeof name === 'string' && names.includes(name)
        })
        .map((item) => fields(item, keys))

export const projectPreviewBaseMetadata = (value: unknown) => {
    const base = record(record(value).previews_base_config)
    return projectWorkerMetadata({
        ...base,
        bindings: Object.entries(record(base.env)).map(([name, binding]) => ({
            ...record(binding),
            name,
        })),
    })
}

export const collectCloudflareInventory = async (
    accountId: string,
    token: string,
    fetcher: typeof fetch = fetch,
) => {
    if (!/^[a-f0-9]{32}$/.test(accountId) || !token)
        throw new Error('The existing preview Environment requires both valid credential inputs.')
    const workers = ['avatio', 'avatio-development']
    type ReadRequest = {
        label: string
        path: string
        sql?: string
        project: (value: unknown) => unknown
    }
    const requests: ReadRequest[] = []
    for (const worker of workers) {
        requests.push(
            {
                label: `${worker} settings`,
                path: `/workers/scripts/${worker}/settings`,
                project: projectWorkerMetadata,
            },
            {
                label: `${worker} schedules`,
                path: `/workers/scripts/${worker}/schedules`,
                project: (value) =>
                    array(record(value).schedules).map((item) =>
                        fields(item, ['cron', 'created_on', 'modified_on']),
                    ),
            },
        )
    }
    requests.push(
        {
            label: 'Avatio D1 identities',
            path: '/d1/database?per_page=100&page=1',
            project: (value) =>
                resourceList(
                    value,
                    'name',
                    [
                        'avatio',
                        'avatio-development',
                        'avatio-content',
                        'avatio-content-development',
                    ],
                    ['uuid', 'name', 'created_at', 'version'],
                ),
        },
        {
            label: 'Avatio KV identities',
            path: '/storage/kv/namespaces?per_page=100&page=1',
            project: (value) =>
                resourceList(
                    value,
                    'title',
                    ['avatio', 'avatio-cache-development'],
                    ['id', 'title'],
                ),
        },
        {
            label: 'Avatio Queue identities',
            path: '/queues?per_page=100&page=1',
            project: (value) =>
                resourceList(
                    value,
                    'queue_name',
                    ['item-revalidation', 'item-revalidation-development'],
                    ['queue_id', 'queue_name'],
                ),
        },
        {
            label: 'Avatio domains',
            path: '/workers/domains',
            project: (value) =>
                resourceList(value, 'service', workers, [
                    'id',
                    'hostname',
                    'service',
                    'environment',
                    'zone_id',
                ]),
        },
        {
            label: 'avatio native Preview Base binding identities',
            path: '/workers/workers/avatio',
            project: projectPreviewBaseMetadata,
        },
        {
            label: 'Existing avatio native Previews',
            path: '/workers/workers/avatio/previews',
            project: (value) =>
                array(value).map((item) =>
                    fields(item, ['id', 'name', 'created_on', 'modified_on']),
                ),
        },
        {
            label: 'Avatio Web Analytics settings',
            path: '/rum/site_info/list?per_page=100&page=1',
            project: (value) =>
                array(value)
                    .filter(
                        (item) =>
                            record(item).host === 'avatio.me' ||
                            record(record(item).ruleset).zone_name === 'avatio.me' ||
                            array(record(item).rules).some(
                                (rule) => record(rule).host === 'avatio.me',
                            ),
                    )
                    .map((item) => ({
                        ...fields(item, ['site_tag', 'host', 'auto_install', 'created']),
                        ruleset: fields(record(item).ruleset, [
                            'id',
                            'enabled',
                            'zone_name',
                            'zone_tag',
                        ]),
                        rules: array(record(item).rules).map((rule) =>
                            fields(rule, ['id', 'host', 'inclusive', 'is_paused', 'priority']),
                        ),
                    })),
        },
    )
    for (const bucket of ['avatio', 'avatio-development']) {
        requests.push({
            label: `${bucket} R2 identity`,
            path: `/r2/buckets/${bucket}`,
            project: (value) =>
                fields(value, ['name', 'creation_date', 'location', 'storage_class']),
        })
        requests.push(
            {
                label: `${bucket} R2 custom domains`,
                path: `/r2/buckets/${bucket}/domains/custom`,
                project: (value) =>
                    array(record(value).domains).map((item) => ({
                        ...fields(item, ['domain', 'enabled', 'minTLS', 'zoneId', 'zoneName']),
                        status: fields(record(item).status, ['ownership', 'ssl']),
                    })),
            },
            {
                label: `${bucket} R2 CORS`,
                path: `/r2/buckets/${bucket}/cors`,
                project: (value) =>
                    array(record(value).rules).map((item) => ({
                        ...fields(item, ['id', 'maxAgeSeconds']),
                        allowed: Object.fromEntries(
                            ['origins', 'methods', 'headers'].map((key) => [
                                key,
                                strings(record(record(item).allowed)[key]),
                            ]),
                        ),
                        exposeHeaders: strings(record(item).exposeHeaders),
                    })),
            },
            {
                label: `${bucket} R2 lifecycle`,
                path: `/r2/buckets/${bucket}/lifecycle`,
                project: (value) =>
                    array(record(value).rules).map((item) => ({
                        ...fields(item, ['id', 'enabled']),
                        conditions: fields(record(item).conditions, ['prefix']),
                        ...Object.fromEntries(
                            ['deleteObjectsTransition', 'abortMultipartUploadsTransition'].map(
                                (key) => [
                                    key,
                                    {
                                        condition: fields(record(record(item)[key]).condition, [
                                            'type',
                                            'maxAge',
                                            'date',
                                        ]),
                                    },
                                ],
                            ),
                        ),
                    })),
            },
        )
    }
    type ReadResult = {
        label: string
        status?: number
        available: boolean
        responseShape?: string
        metadata?: unknown
    }
    const readMetadata = async (request: ReadRequest): Promise<ReadResult> => {
        try {
            const response = await fetcher(
                `https://api.cloudflare.com/client/v4/accounts/${accountId}${request.path}`,
                {
                    method: request.sql ? 'POST' : 'GET',
                    redirect: 'error',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        ...(request.sql ? { 'Content-Type': 'application/json' } : {}),
                    },
                    ...(request.sql ? { body: JSON.stringify({ sql: request.sql }) } : {}),
                    signal: AbortSignal.timeout(15_000),
                },
            )
            if (!response.ok) {
                return { label: request.label, status: response.status, available: false }
            }
            const payload = record(await response.json())
            return {
                label: request.label,
                status: response.status,
                available: payload.success === true,
                responseShape: Array.isArray(payload.result) ? 'array' : typeof payload.result,
                ...(payload.success === true ? { metadata: request.project(payload.result) } : {}),
            }
        } catch {
            return { label: request.label, available: false }
        }
    }
    const results = await Promise.all(requests.map(readMetadata))
    const metadata = (label: string) => results.find((item) => item.label === label)?.metadata
    for (const item of array(metadata('Avatio Queue identities'))) {
        const queue = record(item)
        if (
            typeof queue.queue_name !== 'string' ||
            typeof queue.queue_id !== 'string' ||
            !/^[a-f0-9]{32}$/.test(queue.queue_id)
        )
            continue
        results.push(
            await readMetadata({
                label: `${queue.queue_name} consumers`,
                path: `/queues/${queue.queue_id}/consumers`,
                project: (value) =>
                    array(value).map((consumer) => ({
                        ...fields(consumer, [
                            'consumer_id',
                            'type',
                            'script',
                            'queue_name',
                            'dead_letter_queue',
                        ]),
                        settings: fields(record(consumer).settings, [
                            'batch_size',
                            'max_wait_time_ms',
                            'max_retries',
                        ]),
                    })),
            }),
        )
    }
    for (const worker of workers) {
        const binding = array(record(metadata(`${worker} settings`)).bindings)
            .map(record)
            .find((item) => item.name === 'FLAGS' && item.type === 'flagship')
        if (typeof binding?.app_id !== 'string' || !/^[a-f0-9-]{36}$/.test(binding.app_id)) continue
        results.push(
            await readMetadata({
                label: `${worker} Flagship identity`,
                path: `/flagship/apps/${binding.app_id}`,
                project: (value) => fields(value, ['id', 'name', 'created_at', 'updated_at']),
            }),
        )
    }
    const queryRows = (value: unknown) =>
        array(value).flatMap((item) => {
            if (record(item).success !== true) throw new Error('D1 metadata query unavailable.')
            return array(record(item).results)
        })
    const ledgerColumns = ['id', 'name', 'hash', 'created_at', 'applied_at']
    for (const item of array(metadata('Avatio D1 identities'))) {
        const database = record(item)
        if (
            typeof database.name !== 'string' ||
            !workers.includes(database.name) ||
            typeof database.uuid !== 'string' ||
            !/^[a-f0-9-]{36}$/.test(database.uuid)
        )
            continue
        for (const table of ['__alchemy_migrations', '__drizzle_migrations', 'd1_migrations']) {
            // These fixed PRAGMAs and SELECTs only inspect bookkeeping. No application rows are read.
            const columns = await readMetadata({
                label: `${database.name} ${table} columns`,
                path: `/d1/database/${database.uuid}/query`,
                sql: `PRAGMA table_info("${table}")`,
                project: (value) =>
                    queryRows(value).map((row) => fields(row, ['name', 'type', 'pk'])),
            })
            results.push(columns)
            const selected = ledgerColumns.filter((column) =>
                array(columns.metadata).some((row) => record(row).name === column),
            )
            if (selected.length === 0) continue
            results.push(
                await readMetadata({
                    label: `${database.name} ${table} applied history`,
                    path: `/d1/database/${database.uuid}/query`,
                    sql: `SELECT ${selected.map((column) => `"${column}"`).join(', ')} FROM "${table}" LIMIT 1000`,
                    project: (value) => queryRows(value).map((row) => fields(row, ledgerColumns)),
                }),
            )
        }
    }
    return {
        readOnly: true,
        inventoryComplete: false,
        migrationHistoryVerified: false,
        deploymentVerified: false,
        results,
    }
}

if (import.meta.main) {
    try {
        const report = await collectCloudflareInventory(
            process.env.CLOUDFLARE_ACCOUNT_ID ?? '',
            process.env.CLOUDFLARE_API_TOKEN ?? '',
        )
        console.log(JSON.stringify(report, null, 2))
        if (report.results.some(({ available }) => !available)) process.exitCode = 1
    } catch {
        console.error(
            'Cloudflare inventory stopped before completion. Credential values are omitted.',
        )
        process.exitCode = 1
    }
}
