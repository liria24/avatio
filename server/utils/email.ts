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

const defaultEmailFrom = 'hello@avatio.me'

export const getEmailFromAddress = () => {
    const bindingAddress = getRuntimeEnvString('NUXT_EMAIL_FROM_ADDRESS')
    if (bindingAddress) return bindingAddress

    try {
        const config = useRuntimeConfig()
        const fromAddress = config.email?.fromAddress
        if (typeof fromAddress === 'string' && fromAddress) return fromAddress
    } catch {
        // runtime config is unavailable in isolated unit tests
    }

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

export const sendEmail = async (input: SendEmailInput) =>
    await getEmailBinding().send({
        ...input,
        from: input.from ?? getEmailFromAddress(),
    })
