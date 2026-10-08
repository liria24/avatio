import type { createCloudflareConfig } from '../config/cloudflare.ts'
import {
    verifyCloudflarePreviewBindings,
    type createCloudflareNativeApi,
} from './cloudflareNativeApi.ts'

/** Bounded observations, not URL acceptance or source/secret attestation. Never print raw values. */
export const inspectCloudflarePreviewMetadata = (
    value: NonNullable<
        Awaited<ReturnType<ReturnType<typeof createCloudflareNativeApi>['previewDeployment']>>
    >,
    expected: ReturnType<typeof createCloudflareConfig>['worker']['env'],
    siteUrl: string,
) => {
    const stable = new URL(siteUrl)
    const workersDev = stable.hostname.endsWith('.workers.dev')
    const suffix = workersDev ? stable.hostname.slice('development-avatio'.length) : ''
    const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value.id)
    const urls = Array.isArray(value.urls) ? value.urls.slice(0, 16) : []
    const shapes = urls.map((raw) => {
        let url: URL | undefined
        try {
            if (typeof raw === 'string') url = new URL(raw)
        } catch {
            /* no raw error */
        }
        const httpsOrigin =
            !!url &&
            url.protocol === 'https:' &&
            !url.port &&
            !url.username &&
            !url.password &&
            !url.search &&
            !url.hash &&
            url.pathname === '/'
        const ownedWorkersOrigin =
            httpsOrigin &&
            workersDev &&
            suffix.startsWith('.') &&
            !!url &&
            url.hostname.endsWith(suffix) &&
            url.hostname.endsWith(`-avatio${suffix}`) &&
            url.origin.length <= 263 &&
            url.hostname.split('.').every((label) => label.length > 0 && label.length <= 63) &&
            /^[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev$/.test(url.hostname)
        return {
            string: typeof raw === 'string',
            parseable: !!url,
            httpsOrigin,
            workersDev: !!url?.hostname.endsWith('.workers.dev'),
            accountSuffixMatches:
                !!url && workersDev && suffix.startsWith('.') && url.hostname.endsWith(suffix),
            workerSuffixMatches: !!url && url.hostname.endsWith(`-avatio${suffix}`),
            fullDeploymentIdMatches: !!url && url.hostname === `${value.id}-avatio${suffix}`,
            uuidPrefixMatches:
                !!url && uuid && url.hostname === `${value.id.slice(0, 8)}-avatio${suffix}`,
            previewInfixMatches:
                !!url && url.hostname === `${value.id}-development-avatio${suffix}`,
            stableUrl: !!url && url.origin === stable.origin,
            ...(ownedWorkersOrigin && url ? { origin: url.origin } : {}),
        }
    })
    const types: Record<string, string> = {
        text: 'plain_text',
        secret: 'secret_text',
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
    const bindings = Object.entries(expected).map(([name, binding]) => {
        let contractMatches = false
        try {
            verifyCloudflarePreviewBindings(
                { ...value, env: { [name]: value.env[name] } },
                { [name]: binding },
                { mode: 'development', deploymentId: value.id },
            )
            contractMatches = true
        } catch {
            /* only the result, never mismatching text/secret/identity values */
        }
        return {
            name,
            expectedType: types[binding.type] ?? 'unmapped',
            namePresent: Object.hasOwn(value.env, name),
            wire: value.wireEnvEvidence?.names[name],
            contractMatches,
        }
    })
    const secretNames = Object.entries(expected)
        .filter(([, binding]) => binding.type === 'secret')
        .map(([name]) => name)
    const missingSecrets = secretNames.filter((name) => !Object.hasOwn(value.env, name))
    const nonSecrets = bindings.filter((binding) => !secretNames.includes(binding.name))
    const unexpected = Object.keys(value.env).filter(
        (name) => !Object.hasOwn(expected, name),
    ).length
    const partialPublication =
        secretNames.length === 2 &&
        ['NUXT_BETTER_AUTH_SECRET', 'TWITTER_CLIENT_SECRET'].every((name) =>
            missingSecrets.includes(name),
        ) &&
        nonSecrets.length > 0 &&
        nonSecrets.every((binding) => binding.contractMatches) &&
        unexpected === 0
    return {
        deploymentIdIsUuid: uuid,
        ...(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value.preview_id)
            ? { previewId: value.preview_id }
            : {}),
        partialPublication: {
            exactMissingSecretPattern: partialPublication,
            matchingNonSecretBindings: nonSecrets.filter((binding) => binding.contractMatches)
                .length,
            missingDeclaredSecretNames: missingSecrets,
            sourceProvenanceVerified: false,
            secretOnlyRepairAuthorized: false,
            mutationAuthorized: false,
            ...(partialPublication
                ? {
                      recommendation: 'fresh-reviewed-artifact-and-explicit-owner-authorization',
                      prerequisites: [
                          'reviewed-existing-preview-and-exact-latest-deployment',
                          'fresh-exact-sha-artifact-and-successful-full-quality-run',
                          'matching-inventory-and-complete-nonsecret-binding-contract',
                          'unchanged-schema-and-ledger',
                          'owner-one-time-base-auth-and-development-oauth-initialization',
                          'no-per-publication-secret-transfer-and-exact-version-verification',
                      ] as const,
                  }
                : {}),
        },
        ...(uuid ? { deploymentId: value.id } : {}),
        urlArray: Array.isArray(value.urls),
        urlCount: Array.isArray(value.urls) ? Math.min(value.urls.length, 16) : 0,
        urlsTruncated: Array.isArray(value.urls) && value.urls.length > 16,
        urls: shapes,
        wireEnv: value.wireEnvEvidence ? { ...value.wireEnvEvidence, names: undefined } : undefined,
        expectedBindingCount: bindings.length,
        observedBindingCount: Math.min(Object.keys(value.env).length, 256),
        unexpectedBindingCount: Math.min(
            Object.keys(value.env).filter((name) => !Object.hasOwn(expected, name)).length,
            256,
        ),
        bindings,
    }
}
