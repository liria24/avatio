import { assertMethod, getHeader, type H3Event } from '@nuxt/nitro-server/h3'

import { getPreviewKind } from '../../config/preview'
import { parseConfiguredAuthOrigins } from './authOrigins'

/** Cookie-authenticated HTTP jobs require a deliberate same-application POST. */
export const requireAdminJobRequest = async (event: H3Event) => {
    await requireAdminSession(event)
    assertMethod(event, 'POST')

    const origin = getHeader(event, 'origin')
    let url: URL
    try {
        url = new URL(origin ?? '')
    } catch {
        throw serverError.forbidden()
    }
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin)
        throw serverError.forbidden()

    const allowedOrigins = parseConfiguredAuthOrigins(getRuntimeEnvString('AUTH_TRUSTED_ORIGINS'))
    const preview = getPreviewKind(
        getRuntimeEnvString('STAGE'),
        getRuntimeEnvString('PREVIEW_NAME'),
    )
    if (!preview) {
        const siteUrl = useRuntimeConfig(event).public.siteUrl
        if (typeof siteUrl === 'string')
            allowedOrigins.push(...parseConfiguredAuthOrigins(JSON.stringify([siteUrl])))
    }
    if (!allowedOrigins.includes(origin)) throw serverError.forbidden()
}
