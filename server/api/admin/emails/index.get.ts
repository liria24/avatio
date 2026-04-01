import type { InboundEmail } from '@unosend/node'
import rfc2047 from 'rfc2047'

// Temporary workaround: actual API response shape differs from @unosend/node types.
// Track: https://github.com/unosend/unosend-node (remove once library is fixed)
interface ActualInboundEmail {
    id: string
    from_email: string
    from_name?: string
    to_emails: string[]
    subject: string
    text_content?: string
    html_content?: string
    spam_status?: string
    dkim_result?: string
    spf_result?: string
    dmarc_result?: string
    status?: string
    received_at: string
    created_at?: string
    attachments: unknown[]
}

export default adminSessionEventHandler<InboundEmail[]>(async () => {
    const unosend = useUnosend()
    const { data, error } = await unosend.inbound.list({ page: 1 })

    if (error)
        throw serverError.internalServerError({
            log: {
                tag: '/api/admin/emails:GET',
                message: `Failed to fetch inbound emails: ${error.message}`,
            },
        })

    return ((data as unknown as ActualInboundEmail[]) ?? []).map(
        (email) =>
            ({
                id: email.id,
                from: email.from_email,
                from_name: email.from_name || undefined,
                to: email.to_emails.join(', '),
                subject: rfc2047.decode(email.subject),
                text: email.text_content
                    ? Buffer.from(email.text_content.replace(/\r?\n/g, ''), 'base64').toString(
                          'utf8',
                      )
                    : undefined,
                html: email.html_content,
                attachment_count: email.attachments.length,
                received_at: email.received_at,
            }) satisfies InboundEmail,
    )
})
