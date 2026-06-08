import { z } from 'zod'

const params = z.object({
    id: z.union([z.string().transform((val) => Number(val)), z.number()]),
})

export default adminSessionEventHandler(async ({ db }) => {
    const { id } = await validateParams(params)

    const email = await db.query.emails.findFirst({
        where: { id: { eq: id } },
    })

    if (!email) throw serverError.notFound()

    return {
        text: email.textBody,
        html: email.htmlBody,
        attachments: email.attachments,
    }
})
