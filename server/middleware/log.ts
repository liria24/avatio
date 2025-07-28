import { consola } from 'consola'

export default defineEventHandler(() => {
    const event = useEvent()

    if (!event.path.startsWith('/_ipx'))
        consola
            .withTag(`API Request ${new Date().toLocaleTimeString()}`)
            .info(`${event.method.toUpperCase()}: ${getRequestURL(event)}`)
})
