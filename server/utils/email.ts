import type { EmailDestinations, EmailReplyMessageBuilder } from '@cloudflare/workers-types'
import { createError } from '@nuxt/nitro-server/h3'

export type SendEmailInput = Omit<EmailReplyMessageBuilder, 'from'> & {
    from?: EmailReplyMessageBuilder['from']
    to: NonNullable<EmailDestinations['to']>
    cc?: EmailDestinations['cc']
    bcc?: EmailDestinations['bcc']
}

export const getEmailFromAddress = () =>
    import.meta.dev ? 'avatio@localhost' : getRuntimeStageConfig().emailFrom

const getEmailBinding = () => {
    const binding = getRuntimeEnv().EMAIL
    if (!binding || typeof binding.send !== 'function')
        throw new Error('Cloudflare Email binding EMAIL is unavailable in this environment.')
    return binding
}

export const sendEmail = async (input: SendEmailInput) => {
    const config = getRuntimeStageConfig()
    const allowedRecipients = config.emailAllowedRecipients
    if (!import.meta.dev && allowedRecipients) {
        const recipients = [input.to, input.cc, input.bcc].flatMap((value) =>
            value === undefined ? [] : Array.isArray(value) ? value : [value],
        )
        if (
            recipients.some(
                (address) =>
                    !allowedRecipients.includes(
                        (typeof address === 'string' ? address : address.email)
                            .trim()
                            .toLowerCase(),
                    ),
            )
        )
            throw createError({
                statusCode: 403,
                statusMessage: 'Email recipient is not allowed in development.',
            })
    }
    const message = {
        ...input,
        from: input.from ?? getEmailFromAddress(),
        subject: import.meta.dev ? input.subject : `${config.emailSubjectPrefix}${input.subject}`,
    }
    if (import.meta.dev) {
        const { saveLocalEmail } = await import('./email.local')
        return saveLocalEmail(message)
    }
    return getEmailBinding().send(message)
}
