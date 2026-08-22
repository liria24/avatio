import type { H3Event } from 'h3'

import type { WebsiteEnv } from '../../alchemy.run'

/** Runtime bindings injected by the Alchemy Website resource. */
export type RuntimeEnv = Partial<WebsiteEnv>

declare const useEvent: (() => H3Event) | undefined

const getGlobalRuntimeEnv = (): RuntimeEnv | undefined =>
    (globalThis as typeof globalThis & { __env__?: RuntimeEnv }).__env__

const getCloudflareRuntimeEnv = (event?: H3Event) => event?.context.cloudflare?.env

const getCurrentEventRuntimeEnv = () => {
    try {
        if (typeof useEvent !== 'function') return undefined
        return getCloudflareRuntimeEnv(useEvent())
    } catch {
        // not inside a request context
    }
}

const getRuntimeEnvSources = (event?: H3Event): RuntimeEnv[] =>
    [getGlobalRuntimeEnv(), getCloudflareRuntimeEnv(event), getCurrentEventRuntimeEnv()].filter(
        (env): env is RuntimeEnv => Boolean(env),
    )

export const getRuntimeEnv = (event?: H3Event): RuntimeEnv =>
    Object.assign({}, ...getRuntimeEnvSources(event))

export const getRuntimeEnvString = (name: keyof RuntimeEnv, event?: H3Event) => {
    for (const env of getRuntimeEnvSources(event)) {
        const value = env[name]
        if (typeof value === 'string' && value) return value
    }
}
