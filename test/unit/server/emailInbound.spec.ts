import { describe, expect, it } from 'vitest'

const loadParser = async () => await import('../../../server/utils/emailInbound')

const encodeEmail = (source: string): ArrayBuffer => {
    const bytes = new TextEncoder().encode(source)
    const raw = new ArrayBuffer(bytes.byteLength)
    new Uint8Array(raw).set(bytes)
    return raw
}

describe('emailInbound', () => {
    it('parses plain text email metadata and body', async () => {
        const { parseInboundEmail } = await loadParser()
        const raw = encodeEmail(`From: "Sender" <sender@example.com>
To: hello@avatio.me
Subject: Hello
Date: Tue, 27 Aug 2024 15:49:44 +0000
Message-ID: <plain-1@example.com>
Content-Type: text/plain; charset=utf-8

Hello from text.`)

        const row = await parseInboundEmail({
            from: 'sender@example.com',
            to: 'hello@avatio.me',
            headers: new Headers(),
            raw,
            rawSize: raw.byteLength,
        })

        expect(row).toMatchObject({
            messageId: '<plain-1@example.com>',
            subject: 'Hello',
            fromAddress: 'sender@example.com',
            fromName: 'Sender',
            toAddress: 'hello@avatio.me',
            snippet: 'Hello from text.',
            textBody: 'Hello from text.',
            htmlBody: null,
            rawSize: raw.byteLength,
        })
    })

    it('uses stripped html for snippets and sanitizes html body', async () => {
        const { parseInboundEmail } = await loadParser()
        const raw = encodeEmail(`From: sender@example.com
To: hello@avatio.me
Subject: HTML only
Message-ID: <html-1@example.com>
Content-Type: text/html; charset=utf-8

<p>Hello <strong>HTML</strong></p><script>alert("x")</script>`)

        const row = await parseInboundEmail({
            from: 'sender@example.com',
            to: 'hello@avatio.me',
            headers: new Headers(),
            raw,
            rawSize: raw.byteLength,
        })

        expect(row.snippet).toBe('Hello HTML')
        expect(row.htmlBody).toBe('<p>Hello <strong>HTML</strong></p>')
    })

    it('removes remote images from html bodies', async () => {
        const { parseInboundEmail } = await loadParser()
        const raw = encodeEmail(`From: sender@example.com
To: hello@avatio.me
Subject: Tracking pixel
Message-ID: <html-img-1@example.com>
Content-Type: text/html; charset=utf-8

<p>Hello</p><img src="https://tracker.example.com/pixel.png" alt="pixel"><a href="https://example.com">safe</a>`)

        const row = await parseInboundEmail({
            from: 'sender@example.com',
            to: 'hello@avatio.me',
            headers: new Headers(),
            raw,
            rawSize: raw.byteLength,
        })

        expect(row.htmlBody).toBe('<p>Hello</p><a href="https://example.com">safe</a>')
    })

    it('decodes encoded subjects', async () => {
        const { parseInboundEmail } = await loadParser()
        const raw = encodeEmail(`From: sender@example.com
To: hello@avatio.me
Subject: =?UTF-8?B?44GT44KT44Gr44Gh44Gv?=
Message-ID: <encoded-1@example.com>
Content-Type: text/plain; charset=utf-8

Body`)

        const row = await parseInboundEmail({
            from: 'sender@example.com',
            to: 'hello@avatio.me',
            headers: new Headers(),
            raw,
            rawSize: raw.byteLength,
        })

        expect(row.subject).toBe('こんにちは')
    })

    it('stores attachment metadata without attachment content', async () => {
        const { parseInboundEmail } = await loadParser()
        const raw = encodeEmail(`From: sender@example.com
To: hello@avatio.me
Subject: Attachment
Message-ID: <attachment-1@example.com>
MIME-Version: 1.0
Content-Type: multipart/mixed; boundary="boundary"

--boundary
Content-Type: text/plain; charset=utf-8

See attached.
--boundary
Content-Type: text/plain; name="note.txt"
Content-Disposition: attachment; filename="note.txt"
Content-Transfer-Encoding: base64

SGVsbG8=
--boundary--`)

        const row = await parseInboundEmail({
            from: 'sender@example.com',
            to: 'hello@avatio.me',
            headers: new Headers(),
            raw,
            rawSize: raw.byteLength,
        })

        expect(row.attachments).toEqual([
            {
                filename: 'note.txt',
                size: 5,
                type: 'text/plain',
                disposition: 'attachment',
                contentId: undefined,
            },
        ])
    })

    it('builds a deterministic fallback message id for duplicate handling', async () => {
        const { parseInboundEmail } = await loadParser()
        const raw = encodeEmail(`From: sender@example.com
To: hello@avatio.me
Subject: No message id
Date: Tue, 27 Aug 2024 15:49:44 +0000
Content-Type: text/plain; charset=utf-8

Body`)
        const input = {
            from: 'sender@example.com',
            to: 'hello@avatio.me',
            headers: new Headers(),
            raw,
            rawSize: raw.byteLength,
        }

        const first = await parseInboundEmail(input)
        const second = await parseInboundEmail(input)

        expect(first.messageId).toBe(second.messageId)
        expect(first.messageId).toContain('cloudflare:sender@example.com:hello@avatio.me')
    })
})
