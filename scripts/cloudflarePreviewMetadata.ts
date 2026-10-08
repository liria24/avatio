import { isDeepStrictEqual } from 'node:util'

import type { getCloudflareDevelopmentInspectionConfiguration } from '../config/cloudflare.ts'

const record = (value: unknown): Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {}
const types: Record<string, string> = {
    text: 'plain_text',
    secret: 'secret_text',
    d1: 'd1',
    kv: 'kv_namespace',
    r2: 'r2_bucket',
    assets: 'assets',
    flagship: 'flagship',
    'rate-limit': 'ratelimit',
    ai: 'ai',
    images: 'images',
    queue: 'queue',
    'send-email': 'send_email',
}

/** Return known binding names/types and comparisons only, never values or arbitrary wire keys. */
export const inspectCloudflarePreviewMetadata = (
    input: unknown,
    expected: ReturnType<
        typeof getCloudflareDevelopmentInspectionConfiguration
    >['configuration']['worker']['env'],
) => {
    const env = record(input)
    const bindingMatches = Object.entries(expected).map(([name, binding]) => {
        const actual = record(env[name])
        const expectedType = types[binding.type] ?? 'unrecognized-or-absent'
        const observedType =
            typeof actual.type === 'string' && Object.values(types).includes(actual.type)
                ? actual.type
                : 'unrecognized-or-absent'
        let matches = expectedType !== 'unrecognized-or-absent' && actual.type === expectedType
        if (binding.type === 'text') matches &&= actual.text === binding.value
        if (binding.type === 'd1') matches &&= actual.database_id === binding.id
        if (binding.type === 'kv') matches &&= actual.namespace_id === binding.id
        if (binding.type === 'r2') matches &&= actual.bucket_name === binding.name
        if (binding.type === 'queue') matches &&= actual.queue_name === binding.name
        if (binding.type === 'send-email')
            matches &&=
                isDeepStrictEqual(
                    actual.allowed_sender_addresses,
                    binding.allowedSenderAddresses,
                ) &&
                isDeepStrictEqual(
                    actual.allowed_destination_addresses,
                    binding.allowedDestinationAddresses,
                )
        if (binding.type === 'flagship')
            matches &&= actual.id === binding.id || actual.app_id === binding.id
        if (binding.type === 'rate-limit')
            matches &&=
                actual.namespace_id === binding.namespace &&
                record(actual.simple).limit === binding.simple.limit &&
                record(actual.simple).period === binding.simple.period
        return { name, expectedType, observedType, matches }
    })
    const observedCount = Object.keys(env).length
    return {
        bindingsVerified:
            observedCount === bindingMatches.length &&
            bindingMatches.every(({ matches }) => matches),
        unexpectedBindingCount: Math.min(
            Object.keys(env).filter((name) => !Object.hasOwn(expected, name)).length,
            256,
        ),
        bindings: bindingMatches,
        requiredSecrets: bindingMatches
            .filter(({ expectedType }) => expectedType === 'secret_text')
            .map(({ name, observedType }) => ({
                name,
                type: observedType,
                secretTypePresent: observedType === 'secret_text',
            })),
    }
}
