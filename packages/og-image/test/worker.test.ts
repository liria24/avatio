import { describe, expect, it, vi } from 'vitest'

import { requestOgImage } from '../src/client'
import type { OgImageDescriptor, OgImageEnv } from '../src/schema'
import type { OgImageStorage } from '../src/storage'
import {
    cleanupImage,
    cleanupImages,
    descriptorPayload,
    getImage,
    imageIdForDescriptor,
    issueAvatioImage,
} from '../src/worker'

vi.mock('../src/getPreset', async () => {
    const v = await import('valibot')
    const avatioImagePropsSchema = v.object({
        title: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(120)),
        description: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(240))),
    })

    return {
        getPreset: (descriptor: { preset: string; version: string }) =>
            descriptor.preset === 'avatio' && descriptor.version === 'v1'
                ? {
                      id: 'avatio',
                      version: 'v1',
                      props: avatioImagePropsSchema,
                  }
                : undefined,
    }
})

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47])

class MemoryOgImageStorage implements OgImageStorage {
    readonly store = new Map<string, unknown>()
    readonly puts: { key: string; value: string | ArrayBuffer; ttl?: number }[] = []
    failSet = false

    async getItem<T = unknown>(key: string) {
        const value = this.store.get(key)
        if (!value) return null

        if (typeof value === 'string') return value as T
        if (value instanceof ArrayBuffer) return new TextDecoder().decode(value) as T

        return value as T
    }

    async getItemRaw<T = unknown>(key: string) {
        return (this.store.get(key) ?? null) as T | null
    }

    async hasItem(key: string) {
        return this.store.has(key)
    }

    async setItem<T>(key: string, value: T, options?: { ttl?: number }) {
        await this.set(key, String(value), options)
    }

    async setItemRaw<T>(key: string, value: T, options?: { ttl?: number }) {
        await this.set(key, value, options)
    }

    async getKeys(base = '') {
        return [...this.store.keys()].filter((key) => key.startsWith(base))
    }

    async removeItem(key: string) {
        this.store.delete(key)
    }

    private async set(key: string, value: unknown, options?: { ttl?: number }) {
        if (this.failSet) throw new Error('Storage set failed')
        const stored: string | ArrayBuffer =
            typeof value === 'string'
                ? value
                : value instanceof ArrayBuffer
                  ? value
                  : value instanceof Uint8Array
                    ? (value.buffer.slice(
                          value.byteOffset,
                          value.byteOffset + value.byteLength,
                      ) as ArrayBuffer)
                    : String(value)

        this.store.set(key, stored)
        this.puts.push({ key, value: stored, ttl: options?.ttl })
    }
}

const createCtx = () => {
    const promises: Promise<unknown>[] = []

    return {
        promises,
        waitUntil: (promise: Promise<unknown>) => {
            promises.push(promise)
        },
    }
}

const createEnv = (secret = 'secret') =>
    ({
        OG_IMAGE_SECRET: secret,
    }) as unknown as OgImageEnv

describe('og image worker', () => {
    it('issues a deterministic URL after descriptor storage write and starts pre-render', async () => {
        const storage = new MemoryOgImageStorage()
        const env = createEnv()
        const ctx = createCtx()
        const renderPng = vi.fn(async () => png)

        const response = await issueAvatioImage({
            body: {
                secret: 'secret',
                props: { title: '日本語 title', description: 'description' },
            },
            origin: 'https://og.example',
            env,
            waitUntil: ctx.waitUntil,
            renderPng,
            storage,
        })

        expect(response.status).toBe(202)
        const body = (await response.json()) as { url: string }
        expect(body.url).toMatch(/^https:\/\/og\.example\/v1\/images\/[a-f0-9]{64}\.png$/)

        const second = await issueAvatioImage({
            body: {
                secret: 'secret',
                props: { description: 'description', title: '日本語 title' },
            },
            origin: 'https://og.example',
            env,
            waitUntil: createCtx().waitUntil,
            renderPng,
            storage,
        })
        expect((await second.json()) as { url: string }).toEqual(body)

        expect(storage.puts.some((put) => put.key.startsWith('descriptor:'))).toBe(true)
        expect(ctx.promises).toHaveLength(1)
        await Promise.all(ctx.promises)
        expect(
            storage.puts.some((put) => put.key.startsWith('png:') && put.ttl === 2_592_000),
        ).toBe(true)
        expect(renderPng).toHaveBeenCalled()
    })

    it('does not issue URLs for invalid secret, invalid props, or storage write failure', async () => {
        const storage = new MemoryOgImageStorage()

        expect(
            (
                await issueAvatioImage({
                    body: { secret: 'wrong', props: { title: 'Title' } },
                    origin: 'https://og.example',
                    env: createEnv(),
                    waitUntil: createCtx().waitUntil,
                    renderPng: async () => png,
                    storage,
                })
            ).status,
        ).toBe(401)

        expect(
            (
                await issueAvatioImage({
                    body: { secret: 'secret', props: { description: 'missing title' } },
                    origin: 'https://og.example',
                    env: createEnv(),
                    waitUntil: createCtx().waitUntil,
                    renderPng: async () => png,
                    storage,
                })
            ).status,
        ).toBe(400)

        const failingStorage = new MemoryOgImageStorage()
        failingStorage.failSet = true
        expect(
            (
                await issueAvatioImage({
                    body: { secret: 'secret', props: { title: 'Title' } },
                    origin: 'https://og.example',
                    env: createEnv(),
                    waitUntil: createCtx().waitUntil,
                    renderPng: async () => png,
                    storage: failingStorage,
                })
            ).status,
        ).toBe(500)
    })

    it('serves PNG cache hits immediately', async () => {
        const storage = new MemoryOgImageStorage()
        storage.store.set('png:'.concat('a'.repeat(64)), png.buffer)
        const renderPng = vi.fn(async () => png)

        const response = await getImage({
            imageId: 'a'.repeat(64),
            renderPng,
            storage,
        })

        expect(response.status).toBe(200)
        expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
        expect(new Uint8Array(await response.arrayBuffer())).toEqual(png)
        expect(renderPng).not.toHaveBeenCalled()
    })

    it('serves PNG cache hits when the routed image id includes the png extension', async () => {
        const storage = new MemoryOgImageStorage()
        storage.store.set('png:'.concat('a'.repeat(64)), png.buffer)
        const renderPng = vi.fn(async () => png)

        const response = await getImage({
            imageId: `${'a'.repeat(64)}.png`,
            renderPng,
            storage,
        })

        expect(response.status).toBe(200)
        expect(new Uint8Array(await response.arrayBuffer())).toEqual(png)
        expect(renderPng).not.toHaveBeenCalled()
    })

    it('bypasses PNG and failed caches in dev mode and renders every GET', async () => {
        const storage = new MemoryOgImageStorage()
        const descriptor: OgImageDescriptor = {
            preset: 'avatio',
            version: 'v1',
            props: { title: 'Title' },
        }
        const imageId = await imageIdForDescriptor(descriptor)
        const renderedPng = new Uint8Array([0x01, 0x02, 0x03, 0x04])

        storage.store.set(`descriptor:${imageId}`, descriptorPayload(descriptor))
        storage.store.set(`png:${imageId}`, png.buffer)
        storage.store.set(`failed:${imageId}`, '1')

        const renderPng = vi.fn(async () => renderedPng)

        const first = await getImage({
            imageId,
            bypassCache: true,
            renderPng,
            storage,
        })
        const second = await getImage({
            imageId,
            bypassCache: true,
            renderPng,
            storage,
        })

        expect(first.status).toBe(200)
        expect(first.headers.get('cache-control')).toBe('no-store')
        expect(new Uint8Array(await first.arrayBuffer())).toEqual(renderedPng)
        expect(second.status).toBe(200)
        expect(renderPng).toHaveBeenCalledTimes(2)
        expect(
            storage.puts.some((put) => put.key.startsWith('png:') || put.key.startsWith('failed:')),
        ).toBe(false)
    })

    it('renders synchronously on GET cache miss and stores PNG', async () => {
        const storage = new MemoryOgImageStorage()
        const descriptor: OgImageDescriptor = {
            preset: 'avatio',
            version: 'v1',
            props: { title: 'Title' },
        }
        const imageId = await imageIdForDescriptor(descriptor)
        storage.store.set(`descriptor:${imageId}`, descriptorPayload(descriptor))

        const response = await getImage({
            imageId,
            renderPng: async () => png,
            storage,
        })

        expect(response.status).toBe(200)
        expect(storage.store.has(`png:${imageId}`)).toBe(true)
    })

    it('accepts parsed descriptor objects from filesystem dev storage', async () => {
        const storage = new MemoryOgImageStorage()
        const descriptor: OgImageDescriptor = {
            preset: 'avatio',
            version: 'v1',
            props: { title: 'Title' },
        }
        const imageId = await imageIdForDescriptor(descriptor)
        storage.store.set(`descriptor:${imageId}`, {
            ...descriptor,
        })

        const response = await getImage({
            imageId,
            bypassCache: true,
            renderPng: async () => png,
            storage,
        })

        expect(response.status).toBe(200)
        expect(new Uint8Array(await response.arrayBuffer())).toEqual(png)
    })

    it('does not write failed markers when dev bypass rendering fails', async () => {
        const storage = new MemoryOgImageStorage()
        const descriptor: OgImageDescriptor = {
            preset: 'avatio',
            version: 'v1',
            props: { title: 'Title' },
        }
        const imageId = await imageIdForDescriptor(descriptor)
        storage.store.set(`descriptor:${imageId}`, descriptorPayload(descriptor))

        const response = await getImage({
            imageId,
            bypassCache: true,
            renderPng: async () => {
                throw new Error('Render failed')
            },
            storage,
        })

        expect(response.status).toBe(404)
        expect(storage.puts.some((put) => put.key.startsWith('failed:'))).toBe(false)
    })

    it('returns 404 no-store for missing descriptors and honors failed backoff', async () => {
        const storage = new MemoryOgImageStorage()

        const missing = await getImage({
            imageId: 'b'.repeat(64),
            renderPng: async () => png,
            storage,
        })
        expect(missing.status).toBe(404)
        expect(missing.headers.get('cache-control')).toBe('no-store')

        storage.store.set(`failed:${'b'.repeat(64)}`, '1')
        const failed = await getImage({
            imageId: 'b'.repeat(64),
            renderPng: async () => png,
            storage,
        })
        expect(failed.status).toBe(404)
    })

    it('sets a five minute failed marker when synchronous rendering times out', async () => {
        const storage = new MemoryOgImageStorage()
        const descriptor: OgImageDescriptor = {
            preset: 'avatio',
            version: 'v1',
            props: { title: 'Title' },
        }
        const imageId = await imageIdForDescriptor(descriptor)
        storage.store.set(`descriptor:${imageId}`, descriptorPayload(descriptor))

        const response = await getImage({
            imageId,
            renderTimeoutMs: 5,
            renderPng: (): Promise<Uint8Array> => new Promise(() => {}),
            storage,
        })

        expect(response.status).toBe(404)
        expect(storage.puts).toContainEqual({ key: `failed:${imageId}`, value: '1', ttl: 300 })
    })

    it('cleans up a specific image id after validating the secret', async () => {
        const storage = new MemoryOgImageStorage()
        const imageId = 'c'.repeat(64)
        const otherImageId = 'd'.repeat(64)
        storage.store.set(`descriptor:${imageId}`, 'descriptor')
        storage.store.set(`png:${imageId}`, png.buffer)
        storage.store.set(`failed:${imageId}`, '1')
        storage.store.set(`png:${otherImageId}`, png.buffer)

        const response = await cleanupImage({
            body: { secret: 'secret' },
            env: createEnv(),
            imageId: `${imageId}.png`,
            storage,
        })

        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({ imageId, deleted: 3 })
        expect(storage.store.has(`descriptor:${imageId}`)).toBe(false)
        expect(storage.store.has(`png:${imageId}`)).toBe(false)
        expect(storage.store.has(`failed:${imageId}`)).toBe(false)
        expect(storage.store.has(`png:${otherImageId}`)).toBe(true)
    })

    it('cleans up all og image keys after validating the secret', async () => {
        const storage = new MemoryOgImageStorage()
        const imageId = 'e'.repeat(64)
        storage.store.set(`descriptor:${imageId}`, 'descriptor')
        storage.store.set(`png:${imageId}`, png.buffer)
        storage.store.set(`failed:${imageId}`, '1')
        storage.store.set('other:key', 'value')

        const response = await cleanupImages({
            body: { secret: 'secret' },
            env: createEnv(),
            storage,
        })

        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({ deleted: 3 })
        expect(storage.store.has(`descriptor:${imageId}`)).toBe(false)
        expect(storage.store.has(`png:${imageId}`)).toBe(false)
        expect(storage.store.has(`failed:${imageId}`)).toBe(false)
        expect(storage.store.has('other:key')).toBe(true)
    })

    it('rejects cleanup requests with invalid ids or secrets', async () => {
        const storage = new MemoryOgImageStorage()

        expect(
            (
                await cleanupImage({
                    body: { secret: 'secret' },
                    env: createEnv(),
                    imageId: 'invalid',
                    storage,
                })
            ).status,
        ).toBe(404)

        expect(
            (
                await cleanupImages({
                    body: { secret: 'wrong' },
                    env: createEnv(),
                    storage,
                })
            ).status,
        ).toBe(401)
    })
})

describe('og image client', () => {
    it('returns issued URLs and undefined on failures', async () => {
        const okFetch = vi.fn(async () =>
            Response.json({ url: 'https://og.example/v1/images/id.png' }, { status: 202 }),
        )

        await expect(
            requestOgImage({
                endpoint: 'https://og.example',
                secret: 'secret',
                preset: 'avatio',
                version: 'v1',
                props: { title: 'Title' },
                fetch: okFetch as typeof fetch,
            }),
        ).resolves.toBe('https://og.example/v1/images/id.png')

        await expect(
            requestOgImage({
                endpoint: 'https://og.example',
                secret: 'secret',
                preset: 'avatio',
                version: 'v1',
                props: { title: 'Title' },
                fetch: vi.fn(async () => new Response(null, { status: 500 })) as typeof fetch,
            }),
        ).resolves.toBeUndefined()
    })
})
