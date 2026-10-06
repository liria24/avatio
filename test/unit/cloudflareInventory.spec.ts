import {
    collectCloudflareInventory,
    projectPreviewBaseMetadata,
    projectWorkerMetadata,
    summarizeCloudflareInventory,
} from '../../scripts/cloudflareInventory'

describe('read-only Cloudflare inventory', () => {
    it('publishes only counts and capability failures, without any obtained metadata or names', async () => {
        const fetcher = vi.fn<typeof fetch>().mockImplementation(async () =>
            Response.json({
                success: true,
                result: { bindings: [{ name: 'PRIVATE_RUNTIME_NAME', type: 'secret_text' }] },
            }),
        )
        const report = await collectCloudflareInventory('a'.repeat(32), 'private-token', fetcher)
        const summary = summarizeCloudflareInventory(report)
        expect(summary.successfulReads).toBe(19)
        expect(summary.unavailable).toEqual([])
        expect(JSON.stringify(summary)).not.toMatch(
            /PRIVATE_RUNTIME_NAME|bindings|private-token|avatio/,
        )
    })
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
        expect(fetcher).toHaveBeenCalledTimes(19)
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
    it('reads Cron metadata from the schedules response envelope', async () => {
        const fetcher = vi.fn<typeof fetch>().mockImplementation(async () =>
            Response.json({
                success: true,
                result: {
                    schedules: [{ cron: '0 22 * * *', secret: 'private-extra-value' }],
                },
            }),
        )
        const report = await collectCloudflareInventory('a'.repeat(32), 'token', fetcher)
        expect(report.results.find(({ label }) => label === 'avatio schedules')).toEqual({
            label: 'avatio schedules',
            status: 200,
            available: true,
            responseShape: 'object',
            metadata: [{ cron: '0 22 * * *' }],
        })
        expect(JSON.stringify(report)).not.toContain('private-')
    })
    it('only queries fixed ledger tables with read-only SQL on identified Avatio databases', async () => {
        const databaseId = '11111111-1111-4111-8111-111111111111'
        const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url, options) => {
            if (
                url ===
                `https://api.cloudflare.com/client/v4/accounts/${'a'.repeat(32)}/d1/database?per_page=100&page=1`
            )
                return Response.json({
                    success: true,
                    result: [
                        { name: 'avatio-development', uuid: databaseId },
                        { name: 'another-app', uuid: databaseId },
                    ],
                })
            if (options?.method === 'POST') {
                if (typeof options.body !== 'string') throw new Error('Expected a JSON body.')
                const { sql } = JSON.parse(options.body) as { sql: string }
                const rows =
                    sql === 'PRAGMA table_info("__alchemy_migrations")'
                        ? [{ name: 'name' }, { name: 'hash' }]
                        : sql.startsWith('SELECT')
                          ? [
                                {
                                    name: 'existing/migration.sql',
                                    hash: 'migration-hash',
                                    secret: 'private-extra-value',
                                },
                            ]
                          : []
                return Response.json({ success: true, result: [{ success: true, results: rows }] })
            }
            return Response.json({ success: true, result: [] })
        })
        const report = await collectCloudflareInventory('a'.repeat(32), 'private-token', fetcher)
        const queries = fetcher.mock.calls.filter(([, options]) => options?.method === 'POST')
        expect(queries).toHaveLength(4)
        for (const [url, options] of queries) {
            expect(url).toBe(
                `https://api.cloudflare.com/client/v4/accounts/${'a'.repeat(32)}/d1/database/${databaseId}/query`,
            )
            if (typeof options?.body !== 'string') throw new Error('Expected a JSON body.')
            const { sql } = JSON.parse(options.body) as { sql: string }
            expect(sql).toMatch(
                /^(PRAGMA table_info\("(__alchemy_migrations|__drizzle_migrations|d1_migrations)"\)|SELECT "name", "hash" FROM "__alchemy_migrations" LIMIT 1000)$/,
            )
        }
        expect(
            report.results.find(({ label }) => label.endsWith('applied history'))?.metadata,
        ).toEqual([{ name: 'existing/migration.sql', hash: 'migration-hash' }])
        expect(JSON.stringify(report)).not.toContain('private-')
    })
    it('rejects malformed account input before any network request', async () => {
        const fetcher = vi.fn<typeof fetch>()
        await expect(
            collectCloudflareInventory('../other-account', 'token', fetcher),
        ).rejects.toThrow()
        expect(fetcher).not.toHaveBeenCalled()
    })
    it('retains zone-based Web Analytics configuration without its token or snippet', async () => {
        const fetcher = vi.fn<typeof fetch>().mockImplementation(async () =>
            Response.json({
                success: true,
                result: [
                    {
                        site_tag: 'analytics-site-id',
                        site_token: 'private-analytics-token',
                        snippet: 'private-analytics-snippet',
                        auto_install: true,
                        ruleset: { zone_name: 'avatio.me', enabled: true },
                        rules: [{ host: 'avatio.me', is_paused: false }],
                    },
                ],
            }),
        )
        const report = await collectCloudflareInventory('a'.repeat(32), 'token', fetcher)
        expect(
            report.results.find(({ label }) => label === 'Avatio Web Analytics settings')?.metadata,
        ).toEqual([
            {
                site_tag: 'analytics-site-id',
                auto_install: true,
                ruleset: { zone_name: 'avatio.me', enabled: true },
                rules: [{ host: 'avatio.me', is_paused: false }],
            },
        ])
        expect(JSON.stringify(report)).not.toContain('private-')
    })
})
