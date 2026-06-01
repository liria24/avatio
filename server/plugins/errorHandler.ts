const log = logger('nitro:error')

export default defineNitroPlugin((nitroApp) => {
    nitroApp.hooks.hook('error', (error, context) => {
        const event = 'event' in context ? context.event : undefined
        const path = event ? getRequestURL(event).pathname : 'unknown'

        const cause = (error as { cause?: unknown }).cause
        if (cause instanceof Error)
            log.error(`[${path}] ${error.message} — cause: ${cause.message}`)
    })
})
