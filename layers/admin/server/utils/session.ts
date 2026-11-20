import { assertMethod, getHeader, type H3Event } from '@nuxt/nitro-server/h3'

export const requireAdminSession = async (event: H3Event) => {
    const session = await requireUserSession(event, { user: { role: 'admin' } })
    assertSessionNotBanned(session)
    return session
}

/** Cookie-authenticated HTTP jobs require a deliberate same-application POST. */
export const requireAdminJobRequest = async (event: H3Event) => {
    await requireAdminSession(event)
    assertMethod(event, 'POST')

    const origin = getHeader(event, 'origin')
    if (!origin) throw serverError.forbidden()
    let url: URL
    try {
        url = new URL(origin)
    } catch {
        throw serverError.forbidden()
    }
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin)
        throw serverError.forbidden()

    const allowedOrigins = import.meta.dev
        ? [useRuntimeConfig(event).public.siteUrl]
        : getRuntimeStageConfig(event).trustedOrigins
    if (!allowedOrigins.includes(origin)) throw serverError.forbidden()
}
