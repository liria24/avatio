import { createOpenAI } from '@ai-sdk/openai'
import type { ProviderPlugin } from 'workers-ai-provider'

// Remove when a released workers-ai-provider includes cloudflare/ai#644.
// https://github.com/cloudflare/ai/pull/644
export const openaiProvider: ProviderPlugin = {
    wireFormat: 'openai',
    create: ({ modelId, fetch, baseURL }) => {
        const provider = createOpenAI({ apiKey: 'unused', fetch, ...(baseURL ? { baseURL } : {}) })
        return /^gpt-5\.6(?:-|$)/.test(modelId)
            ? provider.responses(modelId)
            : provider.chat(modelId)
    },
}
