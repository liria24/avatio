import { readFileSync, readdirSync } from 'node:fs'

describe('GitHub quality-only policy', () => {
    const directory = new URL('../../.github/workflows/', import.meta.url)
    const quality = readFileSync(new URL('quality.yml', directory), 'utf8')

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

    it('retains unrelated release automation without a second Cloudflare publisher', () => {
        const workflows = readdirSync(directory)
            .filter((name) => name.endsWith('.yml'))
            .sort()
        expect(workflows).toEqual(['quality.yml', 'release.yml'])
        for (const name of workflows)
            expect(readFileSync(new URL(name, directory), 'utf8')).not.toMatch(
                /cloudflareDeploy|cloudflareBuilds|wrangler-action|wrangler preview|wrangler deploy/,
            )
    })
})
