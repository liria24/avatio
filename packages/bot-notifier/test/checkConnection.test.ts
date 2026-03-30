import { describe, expect, it } from 'vitest'

import { checkConnection } from '../src/index'

// This integration test sends a real request to Bot.
// It is skipped unless the LIRIA_DISCORD_ENDPOINT and LIRIA_DISCORD_ACCESS_TOKEN
// environment variables are set.
const baseUrl = process.env.LIRIA_DISCORD_ENDPOINT
const apiKey = process.env.LIRIA_DISCORD_ACCESS_TOKEN

describe.skipIf(!baseUrl || !apiKey)('Bot message — integration', () => {
    it('successfully sends a message to the configured Bot endpoint', async () => {
        await expect(checkConnection({ baseUrl, apiKey })).resolves.not.toThrow()
    })
})
