import { createCloudflareConfig } from './cloudflare.ts'
import { parseAvatioStage } from './environment.ts'

/** Standard Wrangler settings from the single reviewed binding contract. No resource creation. */
export const createCloudflareWranglerConfig = (mode: string, inventory: unknown) => {
    const stage = parseAvatioStage(mode)
    const { accountId, worker } = createCloudflareConfig(
        { mode: stage, isPreview: stage === 'development' },
        inventory,
    )
    const entries = Object.entries(worker.env)
    const variables = Object.fromEntries(
        entries.flatMap(([name, binding]) =>
            binding.type === 'text' ? [[name, binding.value]] : [],
        ),
    )
    const resources = {
        vars: variables,
        secrets: {
            required: entries.flatMap(([name, binding]) =>
                binding.type === 'secret' ? [name] : [],
            ),
        },
        d1_databases: entries.flatMap(([name, binding]) =>
            binding.type === 'd1'
                ? [
                      {
                          binding: name,
                          database_id: binding.id,
                          database_name: binding.name,
                          migrations_dir: '../migrations',
                          migrations_pattern: '../migrations/*/migration.sql',
                          migrations_table: 'd1_migrations',
                      },
                  ]
                : [],
        ),
        kv_namespaces: entries.flatMap(([name, binding]) =>
            binding.type === 'kv' ? [{ binding: name, id: binding.id }] : [],
        ),
        r2_buckets: entries.flatMap(([name, binding]) =>
            binding.type === 'r2' ? [{ binding: name, bucket_name: binding.name }] : [],
        ),
        flagship: entries.flatMap(([name, binding]) =>
            binding.type === 'flagship' ? [{ binding: name, app_id: binding.id }] : [],
        ),
        ratelimits: entries.flatMap(([name, binding]) =>
            binding.type === 'rate-limit'
                ? [
                      {
                          name,
                          namespace_id: binding.namespace,
                          simple: { ...binding.simple, period: 60 as const },
                      },
                  ]
                : [],
        ),
        ai: { binding: 'AI' },
        images: { binding: 'IMAGES' },
        send_email: entries.flatMap(([name, binding]) =>
            binding.type === 'send-email'
                ? [{ name, allowed_sender_addresses: binding.allowedSenderAddresses }]
                : [],
        ),
        queues: {
            producers: entries.flatMap(([name, binding]) =>
                binding.type === 'queue' ? [{ binding: name, queue: binding.name }] : [],
            ),
            consumers: worker.triggers.flatMap((trigger) =>
                trigger.type === 'queue'
                    ? [
                          {
                              queue: trigger.name,
                              max_batch_size: trigger.maxBatchSize,
                              max_batch_timeout: trigger.maxBatchTimeout,
                              max_retries: trigger.maxRetries,
                          },
                      ]
                    : [],
            ),
        },
    }
    // Wrangler 4.147 accepts required secrets only at the top level. Preview
    // names/types are checked against the existing Preview before publication.
    const { secrets: _requiredSecrets, ...previewResources } = resources
    return {
        name: worker.name,
        account_id: accountId,
        compatibility_date: worker.compatibilityDate,
        compatibility_flags: worker.compatibilityFlags,
        workers_dev: worker.workersDev,
        preview_urls: worker.previewUrls,
        no_bundle: true,
        rules: [
            { type: 'ESModule' as const, globs: ['**/*.mjs', '**/*.js'] },
            { type: 'CompiledWasm' as const, globs: ['**/*.wasm'], fallthrough: true },
        ],
        assets: { run_worker_first: true },
        observability: {
            enabled: true,
            head_sampling_rate: 1,
            logs: { enabled: true, invocation_logs: true, head_sampling_rate: 1, persist: true },
            traces: { enabled: false },
        },
        cache: { enabled: true },
        routes: worker.domains.map((pattern) => ({ pattern, custom_domain: true })),
        triggers: {
            crons: worker.triggers.flatMap((trigger) =>
                trigger.type === 'scheduled' ? [trigger.schedule] : [],
            ),
        },
        ...resources,
        ...(stage === 'development' ? { previews: previewResources } : {}),
    }
}
