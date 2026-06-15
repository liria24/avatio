import type { H3Event } from 'h3'

export type RuntimeEnv = Partial<Record<string, unknown>>

declare const useEvent: (() => H3Event) | undefined

type RuntimeGlobal = typeof globalThis & {
    __env__?: RuntimeEnv
}

const getGlobalRuntimeEnv = () => (globalThis as RuntimeGlobal).__env__

const getCloudflareRuntimeEnv = (event?: H3Event) =>
    event?.context.cloudflare?.env as RuntimeEnv | undefined

const getCurrentEventRuntimeEnv = () => {
    try {
        if (typeof useEvent !== 'function') return undefined
        return getCloudflareRuntimeEnv(useEvent())
    } catch {
        // not inside a request context
    }
}

const getRuntimeEnvSources = (event?: H3Event): RuntimeEnv[] =>
    [
        getGlobalRuntimeEnv(),
        getCloudflareRuntimeEnv(event),
        getCurrentEventRuntimeEnv(),
        process.env,
    ].filter((env): env is RuntimeEnv => Boolean(env))

export const getRuntimeEnv = (event?: H3Event): RuntimeEnv =>
    getGlobalRuntimeEnv() ??
    getCloudflareRuntimeEnv(event) ??
    getCurrentEventRuntimeEnv() ??
    process.env

export const getRuntimeEnvValue = (name: string, event?: H3Event) => {
    for (const env of getRuntimeEnvSources(event)) {
        const value = env[name]
        if (value !== undefined && value !== null) return value
    }
}

export const getRuntimeEnvString = (name: string, event?: H3Event) => {
    for (const env of getRuntimeEnvSources(event)) {
        const value = env[name]
        if (typeof value === 'string' && value) return value
    }
}
