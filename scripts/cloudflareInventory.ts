// An opt-in inventory of existing resources. This script has no mutation or secret-value API.
type Metadata = Record<string, unknown>

const record = (value: unknown): Metadata =>
    typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Metadata) : {}
const array = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])
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
        compatibility_flags: array(input.compatibility_flags).filter(
            (item): item is string => typeof item === 'string',
        ),
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
    const requests: { label: string; path: string; project: (value: unknown) => unknown }[] = []
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
                    array(value).map((item) => fields(item, ['cron', 'created_on', 'modified_on'])),
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
    )
    for (const bucket of ['avatio', 'avatio-development']) {
        requests.push({
            label: `${bucket} R2 identity`,
            path: `/r2/buckets/${bucket}`,
            project: (value) =>
                fields(value, ['name', 'creation_date', 'location', 'storage_class']),
        })
    }
    const results = []
    for (const request of requests) {
        try {
            const response = await fetcher(
                `https://api.cloudflare.com/client/v4/accounts/${accountId}${request.path}`,
                {
                    method: 'GET',
                    redirect: 'error',
                    headers: { Authorization: `Bearer ${token}` },
                    signal: AbortSignal.timeout(15_000),
                },
            )
            if (!response.ok) {
                results.push({ label: request.label, status: response.status, available: false })
                continue
            }
            const payload = record(await response.json())
            results.push({
                label: request.label,
                status: response.status,
                available: payload.success === true,
                ...(payload.success === true ? { metadata: request.project(payload.result) } : {}),
            })
        } catch {
            results.push({ label: request.label, available: false })
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
