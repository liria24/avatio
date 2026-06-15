import { Files } from 'files-sdk'
import type { StoredFile } from 'files-sdk'
import { r2 } from 'files-sdk/r2'
import type { R2Bucket } from 'files-sdk/r2'

import { getRuntimeEnv } from './runtimeEnv'

declare const useStorage: (base?: string) => {
    getItem: <T>(key: string) => Promise<T | null>
    setItem: <T>(key: string, value: T) => Promise<void>
    removeItem: (key: string) => Promise<void>
}

type StorageClient = InstanceType<typeof Files>

const requireEnv = (name: string) => {
    const value = getRuntimeEnv()[name]
    if (typeof value !== 'string' || !value)
        throw new Error(
            `Missing required environment variable: ${name}. Ensure it is set before starting the server.`,
        )
    return value
}

let storageClient: StorageClient | null = null

const getStorage = () => {
    if (storageClient) return storageClient

    const binding = getRuntimeEnv().R2 as R2Bucket | undefined

    storageClient = new Files({
        adapter:
            binding && typeof binding === 'object'
                ? r2({
                      binding,
                      publicBaseUrl: requireEnv('R2_PUBLIC_BASE_URL'),
                  })
                : r2({
                      bucket: requireEnv('R2_BUCKET'),
                      accountId: requireEnv('R2_ACCOUNT_ID'),
                      accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
                      secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
                      publicBaseUrl: requireEnv('R2_PUBLIC_BASE_URL'),
                  }),
    })
    return storageClient
}

export const storage = new Proxy({} as StorageClient, {
    get: (_target, property) => {
        const client = getStorage()
        const value = Reflect.get(client, property)
        return typeof value === 'function' ? value.bind(client) : value
    },
})

const fileCache = () => useStorage('cache')
const fileCacheKey = (type: 'url' | 'head', key: string) => `files:${type}:${key}`

export const invalidateStorageCache = async (key: string) =>
    await Promise.all([
        fileCache().removeItem(fileCacheKey('url', key)),
        fileCache().removeItem(fileCacheKey('head', key)),
    ])

export const cachedStorageUrl = async (key: string) => {
    const cacheKey = fileCacheKey('url', key)
    const cached = await fileCache().getItem<string>(cacheKey)
    if (cached) return cached

    const url = await storage.url(key)
    await fileCache().setItem(cacheKey, url)
    return url
}

export const cachedStorageHead = async (key: string): Promise<StoredFile> => {
    const cacheKey = fileCacheKey('head', key)
    const cached = await fileCache().getItem<StoredFile>(cacheKey)
    if (cached) return cached

    const head = await storage.head(key)
    await fileCache().setItem(cacheKey, head)
    return head
}
