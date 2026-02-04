export default defineEventHandler((event) => {
    if (import.meta.dev && !event.path.startsWith('/_ipx'))
        logger(`API Request ${new Date().toLocaleTimeString()}`).info(
            `${event.method.toUpperCase()}: ${event.path}`
        )
})
