import { readFileSync, readdirSync } from 'node:fs'

describe('production Builds and development-only GitHub delivery policy', () => {
    const directory = new URL('../../.github/workflows/', import.meta.url)
    const quality = readFileSync(new URL('quality.yml', directory), 'utf8')
    const development = readFileSync(new URL('development.yml', directory), 'utf8')

    it('keeps every PR credentialless and preserves all required quality checks', () => {
        expect(quality).toMatch(/on:\n {2}pull_request:\n {2}push:/)
        expect(quality).toContain("check: [format, lint, 'lint:unused', typecheck, build]")
        expect(quality).toContain('name: test\n')
        expect(quality).not.toMatch(
            /CLOUDFLARE_API_TOKEN|DOTENV_PRIVATE_KEY|NUXT_BETTER_AUTH_SECRET|secrets:|environment:/,
        )
    })

    it('keeps both standard application targets in local synthetic checks only', () => {
        expect(quality).toContain('target: [production, development]')
        expect(quality).toContain('node test/cloudflare/application.mjs')
        expect(quality).toContain('node test/cloudflare/migrations.mjs')
        expect(quality).not.toContain('--remote')
    })

    it('retains unrelated release automation and one development publisher', () => {
        const workflows = readdirSync(directory)
            .filter((name) => name.endsWith('.yml'))
            .sort()
        expect(workflows).toEqual(['development.yml', 'quality.yml', 'release.yml'])
        for (const name of ['quality.yml', 'release.yml'])
            expect(readFileSync(new URL(name, directory), 'utf8')).not.toMatch(
                /cloudflareDeploy|cloudflareBuilds|wrangler-action|wrangler preview|wrangler deploy/,
            )
    })

    it('allows only development pushes before any delivery credential is available', () => {
        expect(development).toContain('on:\n  push:\n    branches: [development]\n')
        expect(development).not.toMatch(
            /pull_request|workflow_dispatch|workflow_run|branches-ignore|WORKERS_CI/,
        )
        expect(development).toContain("if: vars.AVATIO_DEVELOPMENT_DELIVERY_ENABLED == 'true'")
        expect(development).toContain('environment: development')
        expect(development).toContain('ref: ${{ github.sha }}')
        expect(development).toContain('persist-credentials: false')
        expect(development).not.toMatch(
            /DOTENV_PRIVATE_KEY|NUXT_BETTER_AUTH_SECRET|TWITTER_CLIENT_SECRET/,
        )
        const beforeDeploy = development.split(
            'run: node scripts/cloudflareDevelopment.ts deploy',
        )[0]!
        expect(beforeDeploy).not.toContain('secrets.')
        expect(development.match(/secrets\./g)).toHaveLength(1)
    })

    it('keeps migration and publication in one non-cancelling target lock', () => {
        expect(development).toContain(
            'group: avatio-development-APP_DB\n      cancel-in-progress: false',
        )
        expect(development).not.toContain('cancel-in-progress: true')
        expect(development.match(/cloudflareDevelopment\.ts deploy/g)).toHaveLength(1)
        expect(development).not.toMatch(
            /migrations apply|--remote|wrangler-action|create|delete|secret put/,
        )
        expect(development).toContain('path: .cloudflare/delivery/published.json')
    })
})
