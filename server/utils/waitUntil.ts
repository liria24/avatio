const waitUntilLog = logger('waitUntil')

export const runAfterResponse = (promise: Promise<unknown>) => {
    const event = useEvent()

    if (event.waitUntil) {
        event.waitUntil(promise)
        return
    }

    void promise.catch((error) => {
        waitUntilLog.error('Background task failed:', error)
    })
}
