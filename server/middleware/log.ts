export default defineEventHandler((event) => {
    if (import.meta.dev && !event.path.startsWith('/_ipx') && !event.path.startsWith('/__nuxt'))
        logger(`API Request ${new Date().toLocaleTimeString()}`).info(
            `${event.method.toUpperCase()}: ${event.path}`
        )
})
