import { isAbsolute } from 'node:path'

import { createCloudflareConfig } from './cloudflare.ts'

const object = (value: unknown): Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {}
const canonical = (value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
    if (value !== null && typeof value === 'object')
        return `{${Object.entries(value)
            .filter(([, entry]) => entry !== undefined)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`)
            .join(',')}}`
    return JSON.stringify(value) ?? 'undefined'
}

/** App policy on the pinned official reader's result; not a Build Output writer/adapter. */
export const validateCloudflareBuildOutput = (
    input: unknown,
    target: { mode: string; isPreview: boolean; inventory: unknown },
) => {
    const expected = createCloudflareConfig(target, target.inventory)
    const output = object(input)
    const root = object(output.rootConfig)
    const context = object(root.buildContext)
    const workers = object(output.workers)
    if (
        output.version !== 'v0' ||
        root.accountId !== expected.accountId ||
        context.mode !== target.mode ||
        context.isPreview !== target.isPreview ||
        Object.keys(workers).length !== 1 ||
        !workers.default ||
        !Array.isArray(output.containers) ||
        output.containers.length !== 0
    )
        throw new Error('Build Output account, mode or application topology differs from review.')
    const worker = object(workers.default)
    const config = object(worker.config)
    // Only manifest is added by packaging; reject unreviewed bindings/settings, including values
    // attached to secret declarations. Errors deliberately omit actual metadata and values.
    const { entrypoint: _entrypoint, ...settings } = expected.worker
    if (
        Object.keys(config).some((key) => !(key in settings) && key !== 'manifest') ||
        Object.entries(settings).some(([key, value]) => canonical(config[key]) !== canonical(value))
    )
        throw new Error('Build Output settings or complete binding contract differs from review.')
    const manifest = object(config.manifest)
    const modules = object(manifest.modules)
    if (
        manifest.type !== 'complete' ||
        typeof manifest.mainModule !== 'string' ||
        object(modules[manifest.mainModule]).type !== 'esm' ||
        Object.keys(modules).some(
            (name) =>
                !name || isAbsolute(name) || name.includes('\\') || name.split('/').includes('..'),
        ) ||
        typeof worker.bundleDir !== 'string' ||
        !isAbsolute(worker.bundleDir) ||
        typeof worker.assetsDir !== 'string' ||
        !isAbsolute(worker.assetsDir)
    )
        throw new Error('A complete Nitro module bundle and PWA asset tree are required.')
    return {
        mode: target.mode,
        isPreview: target.isPreview,
        workerName: 'avatio' as const,
        configuration: expected,
    }
}
