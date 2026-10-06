import {
    collectCloudflareInventory,
    projectPreviewBaseMetadata,
    projectWorkerMetadata,
} from '../../scripts/cloudflareInventory'

describe('read-only Cloudflare inventory', () => {
    it('projects identities and binding names without variable or secret values', () => {
        const result = projectWorkerMetadata({
            compatibility_date: '2026-05-26',
            bindings: [
                {
                    name: 'BETTER_AUTH_SECRET',
                    type: 'secret_text',
                    text: 'private-signing-value',
                    id: 'private-signing-value',
                },
                { name: 'PUBLIC_SITE_URL', type: 'plain_text', text: 'private-variable-value' },
                { name: 'KEY', type: 'secret_key', id: 'private-key-value' },
                { name: 'APP_DB', type: 'd1', id: 'database-id', secret: 'private-extra-value' },
            ],
            secret: 'private-extra-value',
        })
        expect(result.bindings).toEqual([
            { name: 'BETTER_AUTH_SECRET', type: 'secret_text' },
            { name: 'PUBLIC_SITE_URL', type: 'plain_text' },
            { name: 'KEY', type: 'secret_key' },
            { name: 'APP_DB', type: 'd1', id: 'database-id' },
        ])
        expect(JSON.stringify(result)).not.toContain('private-')
    })
    it('uses only fixed GET endpoints and omits Cloudflare error bodies', async () => {
        const fetcher = vi
            .fn<typeof fetch>()
            .mockResolvedValue(new Response('private-error-token', { status: 403 }))
        const report = await collectCloudflareInventory(
            'a'.repeat(32),
            'private-api-token',
            fetcher,
        )
        expect(fetcher).toHaveBeenCalledTimes(12)
        for (const [url, options] of fetcher.mock.calls) {
            expect(url).toMatch(/^https:\/\/api\.cloudflare\.com\/client\/v4\/accounts\/a{32}\//)
            expect(options?.method).toBe('GET')
            expect(options?.redirect).toBe('error')
            expect(options?.body).toBeUndefined()
        }
        expect(report.results.every(({ available }) => !available)).toBe(true)
        expect(JSON.stringify(report)).not.toContain('private-')
    })
    it('retains only Preview Base binding identities, never their values', () => {
        const result = projectPreviewBaseMetadata({
            previews_base_config: {
                env: {
                    BETTER_AUTH_SECRET: { type: 'secret_text', text: 'private-signing-value' },
                    APP_DB: { type: 'd1', id: 'preview-database-id' },
                },
                secret: 'private-extra-value',
            },
        })
        expect(result.bindings).toEqual([
            { name: 'BETTER_AUTH_SECRET', type: 'secret_text' },
            { name: 'APP_DB', type: 'd1', id: 'preview-database-id' },
        ])
        expect(JSON.stringify(result)).not.toContain('private-')
    })
    it('rejects malformed account input before any network request', async () => {
        const fetcher = vi.fn<typeof fetch>()
        await expect(
            collectCloudflareInventory('../other-account', 'token', fetcher),
        ).rejects.toThrow()
        expect(fetcher).not.toHaveBeenCalled()
    })
})
