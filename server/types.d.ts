import type { WebsiteEnv } from '../alchemy.run'

declare module 'h3' {
    interface H3EventContext {
        cloudflare?: {
            env: WebsiteEnv
        }
    }
}

export {}
