import { execFileSync } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { prepareLocalD1, requireLocalDevelopmentPort } from '../../scripts/localDevelopment'

vi.mock('node:child_process', () => ({ execFileSync: vi.fn(), spawn: vi.fn() }))
vi.mock('node:net', () => ({ createServer: vi.fn() }))

afterEach(() => {
    vi.resetAllMocks()
    vi.unstubAllEnvs()
})

it('prepares only a persistent local APP_DB without inherited credentials', () => {
    const root = mkdtempSync(join(tmpdir(), 'avatio-local-bootstrap-'))
    try {
        vi.stubEnv('CLOUDFLARE_API_TOKEN', 'synthetic-do-not-inherit')
        vi.stubEnv('DOTENV_PRIVATE_KEY_DEVELOPMENT', 'synthetic-do-not-inherit')
        const paths = prepareLocalD1(root)
        const config = JSON.parse(readFileSync(paths.configPath, 'utf8'))
        expect(config.d1_databases).toHaveLength(1)
        expect(config.d1_databases[0].binding).toBe('APP_DB')
        expect(config).not.toHaveProperty('account_id')
        expect(config).not.toHaveProperty('kv_namespaces')
        for (const [, args, options] of vi.mocked(execFileSync).mock.calls) {
            expect(args).toContain('--local')
            expect(args).not.toContain('--remote')
            expect(args).toContain(paths.persistencePath)
            expect(JSON.stringify(options)).not.toContain('synthetic-do-not-inherit')
        }
        expect(existsSync(join(root, '.data/local-auth-secret'))).toBe(true)
    } finally {
        rmSync(root, { recursive: true, force: true })
    }
})

it('stops bootstrap on a migration failure before creating authentication state', () => {
    const root = mkdtempSync(join(tmpdir(), 'avatio-local-bootstrap-'))
    try {
        vi.mocked(execFileSync).mockImplementation(() => {
            throw new Error('Migration failed')
        })
        expect(() => prepareLocalD1(root)).toThrow('Migration failed')
        expect(execFileSync).toHaveBeenCalledTimes(1)
        expect(existsSync(join(root, '.data/local-auth-secret'))).toBe(false)
    } finally {
        rmSync(root, { recursive: true, force: true })
    }
})

it('rejects an occupied development port without stopping its listener', async () => {
    const server = Object.assign(new EventEmitter(), { listen: vi.fn(), close: vi.fn() })
    vi.mocked(createServer).mockReturnValue(server as unknown as ReturnType<typeof createServer>)
    const ready = requireLocalDevelopmentPort()
    server.emit('error', new Error('EADDRINUSE'))
    await expect(ready).rejects.toThrow('Port 3000 is already in use')
    expect(server.listen).toHaveBeenCalledWith(3000, expect.any(Function))
    expect(server.close).not.toHaveBeenCalled()
})
