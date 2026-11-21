import { readFileSync, readdirSync } from 'node:fs'

describe('quality and gated Worker delivery workflow', () => {
    const directory = new URL('../../.github/workflows/', import.meta.url)
    const quality = readFileSync(new URL('quality.yml', directory), 'utf8')
    const [checks, delivery] = quality.split('\n  delivery:\n') as [string, string]

    it('keeps quality checks credentialless with all six required checks', () => {
        expect(checks).toContain("check: [format, lint, 'lint:unused', typecheck, build]")
        expect(checks).toContain('name: test\n')
        expect(checks).not.toMatch(/secrets\.|environment:|--remote/)
    })

    it('keeps diff mutation checking non-blocking and scoped to pull requests', () => {
        const [, mutationSection] = checks.split('\n  mutation:\n')
        expect(mutationSection).toContain('name: mutation (diff)')
        expect(mutationSection).toContain("if: github.event_name == 'pull_request'")
        expect(mutationSection).toContain('continue-on-error: true')
        expect(delivery).not.toContain('mutation')
    })

    it('gates delivery by branch and stage variables with serialized D1 migrations before deploy', () => {
        expect(delivery).toContain('needs: [quality, test]')
        expect(delivery).toContain(
            "github.ref == 'refs/heads/development' && vars.AVATIO_DEVELOPMENT_DELIVERY_ENABLED == 'true'",
        )
        expect(delivery).toContain(
            "github.ref == 'refs/heads/main' && vars.AVATIO_PRODUCTION_DELIVERY_ENABLED == 'true'",
        )
        expect(delivery).toContain(
            "group: avatio-${{ github.ref == 'refs/heads/main' && 'production' || 'development' }}-APP_DB\n      cancel-in-progress: false",
        )
        expect(delivery).not.toMatch(
            /DOTENV_PRIVATE_KEY|NUXT_BETTER_AUTH_SECRET|TWITTER_CLIENT_SECRET/,
        )
        expect(delivery.split('Check initialized runtime secret names')[0]).not.toContain(
            'secrets.',
        )
        const migrateIndex = delivery.indexOf(
            'd1 migrations apply APP_DB --remote --config .output/server/wrangler.json',
        )
        const deployIndex = delivery.indexOf(
            'wrangler.js deploy --config .output/server/wrangler.json',
        )
        expect(migrateIndex).toBeGreaterThan(-1)
        expect(deployIndex).toBeGreaterThan(migrateIndex)
    })

    it('keeps only quality and release workflows', () => {
        expect(
            readdirSync(directory)
                .filter((name) => name.endsWith('.yml'))
                .sort(),
        ).toEqual(['quality.yml', 'release.yml'])
    })
})
