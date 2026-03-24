import { describe, expect, it } from 'vitest'

import { checkDiscordNotification } from '../../server/utils/sendDiscordNotification'

// This integration test sends a real request to Discord.
// It is skipped unless the LIRIA_DISCORD_ENDPOINT and LIRIA_DISCORD_ACCESS_TOKEN
// environment variables are set.
const endpoint = process.env.LIRIA_DISCORD_ENDPOINT
const accessToken = process.env.LIRIA_DISCORD_ACCESS_TOKEN

describe.skipIf(!endpoint || !accessToken)('Discord notification — integration', () => {
    it('successfully sends a notification to the configured Discord webhook', async () => {
        await expect(
            checkDiscordNotification({ endpoint: endpoint!, accessToken: accessToken! }),
        ).resolves.not.toThrow()
    })
})
