import { request } from '@liria24/og-image'
import { z } from 'zod'

const log = logger('/api/og-image:POST')

const body = z.object({
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().max(240).optional(),
})

export default promiseEventHandler<{ url: string | null }>(async () => {
    const props = await validateBody(body, { sanitize: true })

    try {
        return await request({ preset: 'avatio', props })
    } catch (error) {
        log.warn('Failed to issue OG image URL', error)
        return { url: null }
    }
})
