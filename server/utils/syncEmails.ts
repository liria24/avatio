import { emails } from '@@/database/schema'
import rfc2047 from 'rfc2047'

const log = logger('syncEmails')

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
    status?: string
    received_at: string
    attachments: unknown[]
}

function buildSnippet(email: ActualInboundEmail): string | null {
    if (email.text_content) {
        const text = Buffer.from(email.text_content.replace(/\r?\n/g, ''), 'base64').toString(
            'utf8',
        )
        return text.slice(0, 150) || null
    }
    if (email.html_content) {
        const text = email.html_content
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
        return text.slice(0, 150) || null
    }
    return null
}

export async function syncEmails(): Promise<void> {
    const unosend = useUnosend()
    const { data, error } = await unosend.inbound.list({ page: 1 })

    if (error) {
        log.error('Failed to fetch inbound emails from Unosend', error.message)
        throw serverError.internalServerError({
            log: {
                tag: 'syncEmails',
                message: `Failed to fetch inbound emails: ${error.message}`,
            },
        })
    }

    const rows = ((data as unknown as ActualInboundEmail[]) ?? []).map((email) => ({
        messageId: email.id,
        subject: rfc2047.decode(email.subject),
        fromAddress: email.from_email,
        fromName: email.from_name ?? null,
        toAddress: email.to_emails.join(', '),
        snippet: buildSnippet(email),
        receivedAt: new Date(email.received_at),
    }))

    if (rows.length === 0) return

    await db.insert(emails).values(rows).onConflictDoNothing()

    log.info(`Synced ${rows.length} emails`)
}
