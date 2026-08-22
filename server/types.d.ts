import type { WebsiteEnv } from '../alchemy.run'

declare global {
    // Alchemy's Nitro runtime sets this during local dev and Worker startup.
    var __env__: Partial<WebsiteEnv> | undefined
}

export {}
