import { consola } from 'consola'

export default defineEventHandler(() => {
    consola
        .withTag(`API Request ${new Date().toLocaleTimeString()}`)
        .info(
            `${useEvent().method.toUpperCase()}: ${getRequestURL(useEvent())}`
        )
})
