import { beforeEach, describe, expect, it, vi } from 'vitest'

import { sendDiscordNotification } from '../../server/utils/sendDiscordNotification'

const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

const ENDPOINT = 'https://discord.com/api/webhooks/test/token'
const ACCESS_TOKEN = 'test-access-token'
const EMBED = {
    title: 'Test Notification',
    description: 'This is a test',
    color: 0xeeeeee,
}

describe('sendDiscordNotification', () => {
    beforeEach(() => {
        mockFetch.mockClear()
        mockFetch.mockResolvedValue(undefined)
    })

    it('calls $fetch with the correct endpoint, body, and authorization header', async () => {
        await sendDiscordNotification({
            endpoint: ENDPOINT,
            accessToken: ACCESS_TOKEN,
            embeds: [EMBED],
        })

        expect(mockFetch).toHaveBeenCalledWith(
            `${ENDPOINT}/admin/message`,
            expect.objectContaining({
                method: 'POST',
                body: { embeds: [EMBED] },
                headers: { authorization: `Bearer ${ACCESS_TOKEN}` },
            }),
        )
    })

    it('propagates errors thrown by $fetch', async () => {
        mockFetch.mockRejectedValue(new Error('Network error'))

        await expect(
            sendDiscordNotification({
                endpoint: ENDPOINT,
                accessToken: ACCESS_TOKEN,
                embeds: [EMBED],
            }),
        ).rejects.toThrow('Network error')
    })

    it('sends multiple embeds correctly', async () => {
        const embeds = [EMBED, { ...EMBED, title: 'Second embed' }]
        await sendDiscordNotification({ endpoint: ENDPOINT, accessToken: ACCESS_TOKEN, embeds })

        expect(mockFetch).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ body: { embeds } }),
        )
    })
})
