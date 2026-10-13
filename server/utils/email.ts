import { createError } from 'h3'

import { getPreviewKind } from '../../config/preview'

interface EmailAddress {
    email: string
    name?: string
}

interface EmailAttachment {
    content: string | ArrayBuffer | ArrayBufferView
    filename: string
    type: string
    disposition: 'attachment' | 'inline'
    contentId?: string
}

interface SendEmailBinding {
    send(message: {
        from: string | EmailAddress
        to: string | EmailAddress | (string | EmailAddress)[]
        subject: string
        replyTo?: string | EmailAddress
        cc?: string | EmailAddress | (string | EmailAddress)[]
        bcc?: string | EmailAddress | (string | EmailAddress)[]
        headers?: Record<string, string>
        text?: string
        html?: string
        attachments?: EmailAttachment[]
    }): Promise<{ messageId: string }>
}

export interface SendEmailInput {
    to: string | EmailAddress | (string | EmailAddress)[]
    subject: string
    text?: string
    html?: string
    from?: string | EmailAddress
    replyTo?: string | EmailAddress
    cc?: string | EmailAddress | (string | EmailAddress)[]
    bcc?: string | EmailAddress | (string | EmailAddress)[]
    headers?: Record<string, string>
    attachments?: EmailAttachment[]
}

const defaultEmailFrom = import.meta.dev ? 'avatio@localhost' : 'hello@avatio.me'

const requireEmailEnabled = () => {
    if (
        !import.meta.dev &&
        getPreviewKind(getRuntimeEnvString('STAGE'), getRuntimeEnvString('PREVIEW_NAME'))
    )
        throw createError({
            statusCode: 503,
            statusMessage: 'Email sending is disabled in Previews.',
        })
}

export const getEmailFromAddress = () => {
    requireEmailEnabled()
    const bindingAddress = getRuntimeEnvString('EMAIL_FROM')
    if (bindingAddress) return bindingAddress

    return defaultEmailFrom
}

const isSendEmailBinding = (binding: unknown): binding is SendEmailBinding =>
    typeof binding === 'object' &&
    binding !== null &&
    'send' in binding &&
    typeof binding.send === 'function'

const getEmailBinding = () => {
    const binding = getRuntimeEnv().EMAIL
    if (!isSendEmailBinding(binding))
        throw new Error('Cloudflare Email binding EMAIL is unavailable in this environment.')
    return binding
}

export const sendEmail = async (input: SendEmailInput) => {
    requireEmailEnabled()
    const message = {
        ...input,
        from: input.from ?? getEmailFromAddress(),
    }
    if (import.meta.dev) {
        const { saveLocalEmail } = await import('./email.local')
        return saveLocalEmail(message)
    }
    return getEmailBinding().send(message)
}
