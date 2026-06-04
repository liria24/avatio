import type { H3Event } from 'h3'

import type { OgImageEnv, WaitUntil, WorkerExecutionContext } from './schema'

interface NitroCloudflareContext {
    env?: Partial<OgImageEnv>
    context?: WorkerExecutionContext
}

interface NitroEventContext {
    cloudflare?: NitroCloudflareContext
    waitUntil?: WaitUntil
    _platform?: {
        cloudflare?: NitroCloudflareContext
    }
}

const getCloudflareContext = (event: H3Event) => {
    const context = event.context as NitroEventContext
    return context.cloudflare ?? context._platform?.cloudflare
}

export const getOgImageEnv = (event: H3Event) => getCloudflareContext(event)?.env

export const getWaitUntil = (event: H3Event): WaitUntil => {
    const context = event.context as NitroEventContext
    const cloudflare = getCloudflareContext(event)
    const waitUntil = cloudflare?.context?.waitUntil.bind(cloudflare.context) ?? context.waitUntil

    return (promise) => {
        if (waitUntil) {
            waitUntil(promise)
            return
        }

        void promise.catch(() => {})
    }
}
