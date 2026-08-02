import { useEvent } from 'nitropack/runtime/internal/context'

const waitUntilLog = logger('waitUntil')

export const runAfterResponse = (promise: Promise<unknown>) => {
    try {
        const event = useEvent()

        if (event.waitUntil) {
            event.waitUntil(promise)
            return
        }
    } catch {
        // Not running inside an H3 request context, such as a Cloudflare Queue consumer.
    }

    void promise.catch((error) => {
        waitUntilLog.error('Background task failed:', error)
    })
}
