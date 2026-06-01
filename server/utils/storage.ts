import { Files } from 'files-sdk'
import { r2 } from 'files-sdk/r2'
import type { R2Bucket } from 'files-sdk/r2'

type StorageClient = InstanceType<typeof Files>
type RuntimeEnv = Partial<Record<string, string | R2Bucket>>

const getRuntimeEnv = (): RuntimeEnv => {
    const g = globalThis as typeof globalThis & { __env__?: RuntimeEnv }
    if (g.__env__) return g.__env__
    try {
        const cfEnv = useEvent().context.cloudflare?.env
        if (cfEnv) return cfEnv as RuntimeEnv
    } catch {
        // not inside a request context (e.g. during module load or tests)
    }
    return process.env as RuntimeEnv
}

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

    const binding = getRuntimeEnv().R2

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
