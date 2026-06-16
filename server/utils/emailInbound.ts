import type { EmailAttachmentMetadata, emails } from '@@/database/schema'
import type { InferInsertModel } from 'drizzle-orm'
import PostalMime, { type Address, type Email as ParsedEmail } from 'postal-mime'

import { sanitizeEmailHtml } from './sanitizeEmailHtml'

type EmailInsert = InferInsertModel<typeof emails>

interface InboundEmailInput {
    from: string
    to: string
    headers: {
        get(name: string): string | null
    }
    raw: ArrayBuffer
    rawSize: number
    receivedAt?: Date
}

const firstMailbox = (address: Address | undefined) => {
    if (!address) return null
    if (Array.isArray(address.group)) return address.group[0] ?? null
    return address
}

const formatAddressList = (addresses: Address[] | undefined, fallback: string) => {
    const formatted =
        addresses
            ?.flatMap((address) => (Array.isArray(address.group) ? address.group : [address]))
            .map((address) => address.address)
            .filter(Boolean)
            .join(', ') || ''

    return formatted || fallback
}

const stripHtml = (html: string) =>
    html
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

export const buildEmailSnippet = (text?: string, html?: string) => {
    const content = text?.trim() || (html ? stripHtml(html) : '')
    return content.slice(0, 150) || null
}

const attachmentSize = (content: string | ArrayBuffer | Uint8Array) => {
    if (typeof content === 'string') return content.length
    return content.byteLength
}

const mapAttachments = (email: ParsedEmail): EmailAttachmentMetadata[] =>
    email.attachments.map((attachment) => ({
        filename: attachment.filename,
        size: attachmentSize(attachment.content),
        type: attachment.mimeType,
        disposition: attachment.disposition,
        contentId: attachment.contentId,
    }))

const fallbackMessageId = (input: InboundEmailInput, parsed: ParsedEmail) =>
    [
        'cloudflare',
        input.from,
        input.to,
        parsed.date ?? input.headers.get('date') ?? '',
        input.rawSize,
        parsed.subject ?? input.headers.get('subject') ?? '',
    ].join(':')

export const parseInboundEmail = async (input: InboundEmailInput): Promise<EmailInsert> => {
    const parsed = await new PostalMime({
        attachmentEncoding: 'base64',
    }).parse(new Uint8Array(input.raw))
    const from = firstMailbox(parsed.from)
    const html = parsed.html ? sanitizeEmailHtml(parsed.html).trim() : null
    const text = parsed.text?.trim() || null

    return {
        messageId:
            parsed.messageId ?? input.headers.get('message-id') ?? fallbackMessageId(input, parsed),
        subject: parsed.subject ?? input.headers.get('subject'),
        fromAddress: from?.address || input.from,
        fromName: from?.name || null,
        toAddress: formatAddressList(parsed.to, input.to),
        snippet: buildEmailSnippet(text ?? undefined, html ?? undefined),
        textBody: text,
        htmlBody: html,
        attachments: mapAttachments(parsed),
        rawSize: input.rawSize,
        receivedAt: parsed.date ? new Date(parsed.date) : (input.receivedAt ?? new Date()),
    }
}
