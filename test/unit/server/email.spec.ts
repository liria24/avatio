import { afterEach, describe, expect, it, vi } from 'vitest'

import type { SendEmailInput } from '../../../server/utils/email'

type EmailMessage = SendEmailInput & {
    from: NonNullable<SendEmailInput['from']>
}

type SendEmailMock = (message: EmailMessage) => Promise<{ messageId: string }>

type RuntimeGlobal = typeof globalThis & {
    __env__?: {
        EMAIL?: {
            send: SendEmailMock
        }
    }
}

const runtimeGlobal = globalThis as RuntimeGlobal

const loadEmail = async () => await import('../../../server/utils/email')

describe('email', () => {
    afterEach(() => {
        delete runtimeGlobal.__env__
        vi.unstubAllGlobals()
        vi.resetModules()
    })

    it('sends with the default sender', async () => {
        vi.stubGlobal('useRuntimeConfig', () => ({
            email: {
                fromAddress: 'support@avatio.me',
            },
        }))
        const send = vi.fn<SendEmailMock>().mockResolvedValue({
            messageId: 'sent-1',
        })
        runtimeGlobal.__env__ = { EMAIL: { send } }

        const { sendEmail } = await loadEmail()
        await expect(
            sendEmail({
                to: 'sender@example.com',
                subject: 'Re: Hello',
                text: 'Reply',
            }),
        ).resolves.toEqual({ messageId: 'sent-1' })

        expect(send).toHaveBeenCalledWith({
            to: 'sender@example.com',
            subject: 'Re: Hello',
            text: 'Reply',
            from: 'support@avatio.me',
        })
    })

    it('passes reply headers and optional fields through to the binding', async () => {
        const send = vi.fn<SendEmailMock>().mockResolvedValue({
            messageId: 'sent-2',
        })
        runtimeGlobal.__env__ = { EMAIL: { send } }

        const { sendEmail } = await loadEmail()
        await sendEmail({
            to: 'sender@example.com',
            from: 'hello@avatio.me',
            replyTo: 'hello@avatio.me',
            subject: 'Re: Hello',
            text: 'Reply',
            headers: {
                'In-Reply-To': '<original@example.com>',
                References: '<original@example.com>',
            },
        })

        expect(send).toHaveBeenCalledWith({
            to: 'sender@example.com',
            from: 'hello@avatio.me',
            replyTo: 'hello@avatio.me',
            subject: 'Re: Hello',
            text: 'Reply',
            headers: {
                'In-Reply-To': '<original@example.com>',
                References: '<original@example.com>',
            },
        })
    })

    it('reports a missing Cloudflare Email binding clearly', async () => {
        runtimeGlobal.__env__ = {}
        const { sendEmail } = await loadEmail()

        await expect(
            sendEmail({
                to: 'sender@example.com',
                subject: 'Re: Hello',
                text: 'Reply',
            }),
        ).rejects.toThrow('Cloudflare Email binding EMAIL is unavailable')
    })
})
