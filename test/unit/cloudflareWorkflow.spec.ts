import { readFileSync, readdirSync } from 'node:fs'

describe('quality and gated Void delivery', () => {
    const directory = new URL('../../.github/workflows/', import.meta.url)
    const quality = readFileSync(new URL('quality.yml', directory), 'utf8')
    const [checks, delivery] = quality.split('\n  delivery:\n') as [string, string]

    it('keeps every check credentialless and preserves all six required names', () => {
        expect(checks).toMatch(/on:\n {2}pull_request:\n {2}push:/)
        expect(checks).toContain("check: [format, lint, 'lint:unused', typecheck, build]")
        expect(checks).toContain('name: test\n')
        expect(checks).not.toMatch(/secrets\.|environment:|--remote/)
        expect(checks).toContain('target: [production, development]')
        expect(checks).toContain('node test/cloudflare/application.mjs')
        expect(checks).toContain('node test/cloudflare/migrations.mjs')
    })

    it('requires exact branch push quality and a separate activation gate for each target', () => {
        expect(delivery).toContain('needs: [quality, test]')
        expect(delivery).toContain(
            "github.repository == 'liria24/avatio' && github.event_name == 'push'",
        )
        expect(delivery).toContain(
            "github.ref == 'refs/heads/development' && vars.AVATIO_VOID_DEVELOPMENT_DELIVERY_ENABLED == 'true'",
        )
        expect(delivery).toContain(
            "github.ref == 'refs/heads/main' && vars.AVATIO_VOID_PRODUCTION_DELIVERY_ENABLED == 'true'",
        )
        expect(delivery).toContain('ref: ${{ github.sha }}')
        expect(delivery).toContain('persist-credentials: false')
        expect(delivery).toContain('AVATIO_SOURCE_SHA: ${{ github.sha }}')
        expect(delivery).not.toMatch(
            /DOTENV_PRIVATE_KEY|NUXT_BETTER_AUTH_SECRET|TWITTER_CLIENT_SECRET/,
        )
        expect(delivery.split('Check initialized runtime secret names')[0]).not.toContain(
            'secrets.',
        )
    })

    it('serializes migration and publication without cancelling protected pushes', () => {
        expect(checks).toContain(
            "cancel-in-progress: ${{ github.event_name != 'push' || (github.ref != 'refs/heads/development' && github.ref != 'refs/heads/main') }}",
        )
        expect(delivery).toContain(
            "group: avatio-${{ github.ref == 'refs/heads/main' && 'production' || 'development' }}-APP_DB\n      cancel-in-progress: false",
        )
        expect(delivery.match(/git ls-remote origin/g)).toHaveLength(2)
        expect(delivery).toContain(
            'process.env.AVATIO_MIGRATION_HISTORY_VERIFIED, config.d1_databases[0].database_id',
        )
        expect(delivery).toContain(
            'd1 migrations apply APP_DB --remote --config .void-wrangler.jsonc',
        )
        expect(delivery.match(/cli\.mjs deploy --platform cloudflare/g)).toHaveLength(1)
        expect(delivery.indexOf('d1 migrations apply')).toBeLessThan(
            delivery.indexOf('cli.mjs deploy'),
        )
        expect(delivery).toContain("steps.publish.outcome == 'failure'")
        expect(delivery).toContain('path: .cloudflare/delivery/published.json')
    })

    it('retains release automation and removes competing application publishers', () => {
        expect(
            readdirSync(directory)
                .filter((name) => name.endsWith('.yml'))
                .sort(),
        ).toEqual(['quality.yml', 'release.yml'])
        expect(quality).not.toMatch(
            /cloudflareDeploy|cloudflareBuilds|wrangler-action|wrangler preview|wrangler deploy/,
        )
        expect(readFileSync(new URL('release.yml', directory), 'utf8')).not.toMatch(
            /cloudflare|wrangler|void deploy/,
        )
    })
})
