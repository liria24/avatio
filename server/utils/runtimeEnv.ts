import type { H3Event } from '@nuxt/nitro-server/h3'
import { env } from 'void/env'

import { getStageConfig } from '../../config/environment'
import type { AvatioWorkerEnv } from '../types/cloudflare'

/** Runtime bindings available in requests, background handlers, or local development. */
type RuntimeEnv = Partial<AvatioWorkerEnv>

export const getRuntimeEnv = (event?: H3Event): RuntimeEnv =>
    import.meta.prerender ? {} : (event?.context?.cloudflare?.env ?? (env as RuntimeEnv))

export const getRuntimeEnvString = (name: keyof RuntimeEnv, event?: H3Event) => {
    const value = getRuntimeEnv(event)[name]
    if (typeof value === 'string' && value) return value
    if (import.meta.dev) {
        const value = process.env[name]
        if (value) return value
    }
}

export const getRuntimeStageConfig = (event?: H3Event) =>
    getStageConfig(
        import.meta.dev || import.meta.prerender
            ? 'development'
            : (getRuntimeEnvString('STAGE', event) ?? ''),
    )
