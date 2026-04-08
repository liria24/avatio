import { z } from 'zod'

export default promiseEventHandler(async () => {
    const config = useRuntimeConfig()
    const { secret } = await validateQuery(z.object({ secret: z.string() }))

    if (secret !== process.env.CRON_SECRET && secret !== config.adminKey)
        throw serverError.forbidden()

    await syncEmails()
    return { ok: true }
})
