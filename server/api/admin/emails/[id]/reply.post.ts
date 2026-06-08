import { z } from 'zod'

const params = z.object({
    id: z.union([z.string().transform((val) => Number(val)), z.number()]),
})

const body = z.object({
    text: z.string().trim().min(1).max(10000),
})

const replySubject = (subject: string | null) => {
    const value = subject || '(no subject)'
    return value.toLowerCase().startsWith('re:') ? value : `Re: ${value}`
}

export default adminSessionEventHandler(async ({ db }) => {
    const { id } = await validateParams(params)
    const { text } = await validateBody(body)

    const email = await db.query.emails.findFirst({
        where: { id: { eq: id } },
    })

    if (!email) throw serverError.notFound()

    const from = getEmailFromAddress()

    await sendEmail({
        to: email.fromAddress,
        from,
        replyTo: from,
        subject: replySubject(email.subject),
        text,
        headers: {
            'In-Reply-To': email.messageId,
            References: email.messageId,
        },
    })

    return { ok: true }
})
