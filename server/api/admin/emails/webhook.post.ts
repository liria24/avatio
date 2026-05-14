import { z } from 'zod'

export default promiseEventHandler(async () => {
    const { secret } = await validateQuery(z.object({ secret: z.string() }))

    if (secret !== process.env.CRON_SECRET) throw serverError.forbidden()

    await syncEmails()
    return { ok: true }
})
