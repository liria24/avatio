import { afterEach, describe, expect, it, vi } from 'vitest'

import type { SendEmailInput } from '../../../server/utils/email'

type EmailMessage = SendEmailInput & {
    from: NonNullable<SendEmailInput['from']>
}

type SendEmailMock = (message: EmailMessage) => Promise<{ messageId: string }>

type RuntimeGlobal = typeof globalThis & {
    __env__?: {
        STAGE?: string
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
        const send = vi.fn<SendEmailMock>().mockResolvedValue({
            messageId: 'sent-1',
        })
        runtimeGlobal.__env__ = { STAGE: 'production', EMAIL: { send } }

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
            from: 'hello@avatio.me',
        })
    })

    it('passes reply headers and optional fields through to the binding', async () => {
        const send = vi.fn<SendEmailMock>().mockResolvedValue({
            messageId: 'sent-2',
        })
        runtimeGlobal.__env__ = { STAGE: 'production', EMAIL: { send } }

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

    it('sends development mail only to the approved recipient and prefixes the subject', async () => {
        const send = vi.fn<SendEmailMock>().mockResolvedValue({ messageId: 'development' })
        runtimeGlobal.__env__ = { STAGE: 'development', EMAIL: { send } }
        const { sendEmail } = await loadEmail()
        await sendEmail({
            to: 'hello@liria.me',
            cc: { name: 'Owner', email: 'hello@liria.me' },
            subject: 'Test',
            text: 'Body',
        })
        expect(send).toHaveBeenCalledWith(
            expect.objectContaining({ from: 'hello@avatio.me', subject: '[development] Test' }),
        )
    })

    it.each(['to', 'cc', 'bcc'] as const)(
        'rejects the entire development message for an unapproved %s recipient',
        async (field) => {
            const send = vi.fn<SendEmailMock>()
            runtimeGlobal.__env__ = { STAGE: 'development', EMAIL: { send } }
            const { sendEmail } = await loadEmail()
            for (const recipient of [
                'other@example.test',
                { name: 'Other', email: 'other@example.test' },
            ]) {
                await expect(
                    sendEmail({
                        to: 'hello@liria.me',
                        subject: 'Blocked',
                        [field]: ['hello@liria.me', recipient],
                    }),
                ).rejects.toMatchObject({ statusCode: 403 })
            }
            expect(send).not.toHaveBeenCalled()
        },
    )

    it('reports a missing Cloudflare Email binding clearly', async () => {
        runtimeGlobal.__env__ = { STAGE: 'production' }
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
