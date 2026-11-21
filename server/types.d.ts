import type { AvatioWorkerEnv } from './types/cloudflare'

declare module 'h3' {
    interface H3EventContext {
        cloudflare?: {
            env: AvatioWorkerEnv
        }
    }
}

export {}
