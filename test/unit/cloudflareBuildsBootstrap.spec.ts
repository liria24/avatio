import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

describe('cold Workers Builds bootstrap', () => {
    it('loads under plain Node without node_modules, Nuxt output or credentials', () => {
        const root = mkdtempSync(join(tmpdir(), 'avatio-bootstrap-unit-'))
        try {
            mkdirSync(join(root, 'scripts'))
            for (const name of ['cloudflareBuilds.ts', 'cloudflareProcessEnvironment.ts'])
                copyFileSync(
                    new URL(`../../scripts/${name}`, import.meta.url),
                    join(root, 'scripts', name),
                )
            expect(() =>
                execFileSync(
                    process.execPath,
                    ['--input-type=module', '-e', "await import('./scripts/cloudflareBuilds.ts')"],
                    {
                        cwd: root,
                        env: { PATH: process.env.PATH ?? '', CI: 'true' },
                        stdio: 'pipe',
                    },
                ),
            ).not.toThrow()
        } finally {
            rmSync(root, { recursive: true, force: true })
        }
    })
})
