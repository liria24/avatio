import { requestAvatioOgImage } from '@avatio/og-image/client'
import { z } from 'zod'

const log = logger('/api/og-image/avatio:POST')

const body = z.object({
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().max(240).optional(),
})

export default promiseEventHandler(async ({ event }) => {
    const props = await validateBody(body, { sanitize: true })
    const config = useRuntimeConfig(event)
    const endpoint = config.ogImage.endpoint
    const secret = config.ogImage.secret

    if (!endpoint || !secret) return { url: null }

    try {
        return {
            url:
                (await requestAvatioOgImage({
                    endpoint,
                    secret,
                    props,
                })) ?? null,
        }
    } catch (error) {
        log.warn('Failed to issue OG image URL', error)
        return { url: null }
    }
})
