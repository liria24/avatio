import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { R2Bucket } from 'files-sdk/r2'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createLocalStorage } from '../../../server/storage/local'

type RuntimeGlobal = typeof globalThis & {
    __env__?: Partial<Record<string, string | R2Bucket>>
}

const runtimeGlobal = globalThis as RuntimeGlobal

const loadStorage = async (env: RuntimeGlobal['__env__']) => {
    runtimeGlobal.__env__ = env
    return await import('../../../server/utils/storage')
}

describe('storage', () => {
    it('persists local uploads, reads and deletes through files-sdk without R2', async () => {
        const directory = await mkdtemp(join(tmpdir(), 'avatio-files-'))
        try {
            const files = createLocalStorage(directory)
            await files.upload(
                'setup/test/image.png',
                new Blob(['local-image'], { type: 'image/png' }),
            )
            expect(await readFile(join(directory, 'setup/test/image.png'), 'utf8')).toBe(
                'local-image',
            )
            expect(await files.url('setup/test/image.png')).toBe(
                'http://localhost:3000/api/_local/files/setup/test/image.png',
            )
            const downloaded = await files.download('setup/test/image.png')
            expect(await new Response(downloaded.stream()).text()).toBe('local-image')
            expect(downloaded.type).toBe('image/png')
            await files.copy('setup/test/image.png', 'backup/image.png')
            expect(await files.exists('backup/image.png')).toBe(true)
            await files.delete('setup/test/image.png')
            expect(await files.exists('setup/test/image.png')).toBe(false)
            await expect(files.download('../outside')).rejects.toThrow()
        } finally {
            await rm(directory, { recursive: true, force: true })
        }
    })
    afterEach(() => {
        delete runtimeGlobal.__env__
        vi.resetModules()
    })

    it('uses the R2 binding when it is available', async () => {
        const binding = {} as R2Bucket
        const { storage } = await loadStorage({
            R2: binding,
            R2_PUBLIC_BASE_URL: 'https://files.example.com',
            SELF_URL: 'http://127.0.0.1:1337',
            STAGE: 'development',
        })

        expect(storage.adapter.name).toBe('r2-binding')
        expect(storage.raw).toBe(binding)
    })

    it('uses R2 public URLs for deployed development Workers', async () => {
        const { storage } = await loadStorage({
            R2: {} as R2Bucket,
            R2_PUBLIC_BASE_URL: 'https://files.example.com',
            SELF_URL: 'http://127.0.0.1:1467',
            STAGE: 'development',
        })

        await expect(storage.url('uploads/avatar.png')).resolves.toBe(
            'https://files.example.com/uploads/avatar.png',
        )
    })

    it('fails closed when the R2 binding is unavailable', async () => {
        const { storage } = await loadStorage({
            R2_PUBLIC_BASE_URL: 'https://files.example.com',
        })

        expect(() => storage.adapter).toThrowError('Missing required Cloudflare R2 binding: R2')
    })
})
