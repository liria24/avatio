import { z } from 'zod'

const params = z.object({
    id: z.union([z.string().transform((val) => Number(val)), z.number()]),
})

// Actual API response shape differs from @unosend/node types
interface ActualInboundEmailDetail {
    id: string
    subject: string
    from_email: string
    from_name?: string
    to_emails: string[]
    text_content?: string
    html_content?: string
    attachments: { filename: string; size: number; content_type: string }[]
    received_at: string
}

export default adminSessionEventHandler(async () => {
    const { id } = await validateParams(params)

    const email = await db.query.emails.findFirst({
        where: { id: { eq: id } },
    })

    if (!email) throw serverError.notFound()

    const unosend = useUnosend()
    const { data, error } = await unosend.inbound.get(email.messageId)

    if (error)
        throw serverError.internalServerError({
            log: {
                tag: '/api/admin/emails/[id]/body:GET',
                message: `Failed to fetch email body: ${error.message}`,
            },
        })

    const detail = data as unknown as ActualInboundEmailDetail

    return {
        text: detail.text_content
            ? Buffer.from(detail.text_content.replace(/\r?\n/g, ''), 'base64').toString('utf8')
            : null,
        html: detail.html_content ?? null,
        attachments: detail.attachments ?? [],
    }
})
