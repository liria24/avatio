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
        })

        expect(storage.adapter.name).toBe('r2-binding')
        expect(storage.raw).toBe(binding)
    })

    it('falls back to R2 HTTP mode when no binding is available', async () => {
        const { storage } = await loadStorage({
            R2_BUCKET: 'uploads',
            R2_ACCOUNT_ID: 'account-id',
            R2_ACCESS_KEY_ID: 'access-key-id',
            R2_SECRET_ACCESS_KEY: 'secret-access-key',
            R2_PUBLIC_BASE_URL: 'https://files.example.com',
        })

        expect(storage.adapter.name).toBe('r2-http-fetch')
    })

    it('reports missing HTTP fallback environment variables clearly', async () => {
        const { storage } = await loadStorage({
            R2_PUBLIC_BASE_URL: 'https://files.example.com',
        })

        expect(() => storage.adapter).toThrowError(
            'Missing required environment variable: R2_BUCKET',
        )
    })
})
