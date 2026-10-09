import { getStageConfig, parseAvatioStage } from '../../config/environment'
import { validateSecrets } from '../../config/secrets'

describe('stage configuration', () => {
    it('requires the canonical runtime auth name instead of accepting the retired duplicate', () => {
        const result = validateSecrets({
            BETTER_AUTH_SECRET: 'synthetic-old-auth-value-123456789012345',
            TWITTER_CLIENT_SECRET: 'synthetic-twitter',
            OG_IMAGE_SECRET: 'synthetic-og-value-123456789',
        })
        expect(result.success).toBe(false)
        if (!result.success)
            expect(result.issues).toContainEqual(
                expect.objectContaining({ name: 'NUXT_BETTER_AUTH_SECRET' }),
            )
    })
    it('rejects missing and unknown stages instead of falling through to production', () => {
        expect(() => parseAvatioStage('')).toThrow()
        expect(() => parseAvatioStage('preview')).toThrow()
        expect(getStageConfig('production').production).toBe(true)
        expect(getStageConfig('development').production).toBe(false)
    })

    it('reports names and reasons without exposing supplied values', () => {
        const sensitiveValue = 'never-print-this-secret-value'
        const result = validateSecrets({
            NUXT_BETTER_AUTH_SECRET: sensitiveValue,
            BOOTH_PROXY_URL: 'not-a-url',
            TWITTER_CLIENT_SECRET: sensitiveValue,
            OG_IMAGE_SECRET: sensitiveValue,
        })

        expect(result.success).toBe(false)
        if (result.success) return
        const output = JSON.stringify(result.issues)
        expect(output).toContain('NUXT_BETTER_AUTH_SECRET')
        expect(output).toContain('BOOTH_PROXY_URL')
        expect(output).not.toContain(sensitiveValue)
    })

    it('allows BOOTH access without a configured proxy', () => {
        expect(
            validateSecrets({
                NUXT_BETTER_AUTH_SECRET: 'x'.repeat(32),
                TWITTER_CLIENT_SECRET: 'twitter-secret',
                OG_IMAGE_SECRET: 'x'.repeat(16),
            }).success,
        ).toBe(true)
    })

    it('requires both optional Discord settings together', () => {
        const result = validateSecrets({
            NUXT_BETTER_AUTH_SECRET: 'x'.repeat(32),
            BOOTH_PROXY_URL: 'https://booth-proxy.example.com',
            TWITTER_CLIENT_SECRET: 'twitter-secret',
            OG_IMAGE_SECRET: 'x'.repeat(16),
            LIRIA_DISCORD_ENDPOINT: 'https://discord.example.com',
        })

        expect(result.success).toBe(false)
        if (result.success) return
        expect(result.issues).toContainEqual({
            name: 'LIRIA_DISCORD_ACCESS_TOKEN',
            reason: 'must be configured together with the Discord integration counterpart',
        })
    })
})
