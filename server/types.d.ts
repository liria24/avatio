import type { WebsiteEnv } from '../alchemy.run'

declare module 'h3' {
    interface H3EventContext {
        cloudflare?: {
            env: WebsiteEnv
        }
    }
}

declare global {
    var __env__: Partial<WebsiteEnv> | undefined
}

export {}
