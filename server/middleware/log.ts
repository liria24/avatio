export default defineEventHandler(() => {
    const event = useEvent()

    if (import.meta.dev && !event.path.startsWith('/_ipx'))
        logger(`API Request ${new Date().toLocaleTimeString()}`).info(
            `${event.method.toUpperCase()}: ${getRequestURL(event)}`
        )
})
