import { existsSync } from 'node:fs'

import { installDependencies } from '../../scripts/installDependencies'

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }))
vi.mock('node:child_process', () => ({ execFileSync: execute }))

describe('credential-free dependency bootstrap', () => {
    it.each([false, true])(
        'uses a private clean environment and cleans up on failure=%s',
        (fail) => {
            let home = ''
            const outer = {
                PATH: '/synthetic/bin',
                CLOUDFLARE_API_TOKEN: 'synthetic-platform-token',
                GITHUB_TOKEN: 'synthetic-github-token',
                FUTURE_CREDENTIAL: 'synthetic-unknown-token',
                NODE_OPTIONS: '--require=/synthetic/untrusted.cjs',
                HOME: '/synthetic/platform-home',
            }
            const original = { ...outer }
            execute.mockImplementationOnce((command, args, options) => {
                expect(command).toBe(process.platform === 'win32' ? 'bun.exe' : 'bun')
                expect(args).toEqual([
                    'install',
                    '--frozen-lockfile',
                    '--ignore-scripts',
                    '--no-env-file',
                    '--registry',
                    'https://registry.npmjs.org',
                ])
                expect(options.env.CLOUDFLARE_API_TOKEN).toBeUndefined()
                expect(options.env.GITHUB_TOKEN).toBeUndefined()
                expect(options.env.FUTURE_CREDENTIAL).toBeUndefined()
                expect(options.env.NODE_OPTIONS).toBeUndefined()
                expect(options.env.PATH).toBe(outer.PATH)
                home = options.env.HOME
                expect(home).not.toBe(outer.HOME)
                expect(existsSync(home)).toBe(true)
                if (fail) throw new Error('Synthetic install failure')
                return ''
            })
            if (fail) expect(() => installDependencies(outer)).toThrow('Synthetic install failure')
            else installDependencies(outer)
            expect(existsSync(home)).toBe(false)
            expect(outer).toEqual(original)
        },
    )
})
