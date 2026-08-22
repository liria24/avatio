import type { R2Bucket } from 'files-sdk/r2'
import { afterEach, describe, expect, it, vi } from 'vitest'

type RuntimeGlobal = typeof globalThis & {
    __env__?: Partial<Record<string, string | R2Bucket>>
}

const runtimeGlobal = globalThis as RuntimeGlobal

const loadStorage = async (env: RuntimeGlobal['__env__']) => {
    runtimeGlobal.__env__ = env
    return await import('../../../server/utils/storage')
}

describe('storage', () => {
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
        })

        expect(storage.adapter.name).toBe('r2-binding')
        expect(storage.raw).toBe(binding)
    })

    it('uses the injected Alchemy self URL for local object URLs', async () => {
        const { storage } = await loadStorage({
            R2: {} as R2Bucket,
            R2_PUBLIC_BASE_URL: 'https://files.example.com',
            SELF_URL: 'http://127.0.0.1:1467',
        })

        await expect(storage.url('uploads/avatar.png')).resolves.toBe(
            'http://127.0.0.1:1467/api/_local/r2/uploads/avatar.png',
        )
    })

    it('fails closed when the R2 binding is unavailable', async () => {
        const { storage } = await loadStorage({
            R2_PUBLIC_BASE_URL: 'https://files.example.com',
        })

        expect(() => storage.adapter).toThrowError('Missing required Cloudflare R2 binding: R2')
    })
})
