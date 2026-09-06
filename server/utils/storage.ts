import { Files } from 'files-sdk'
import { r2 } from 'files-sdk/r2'
import type { R2Bucket } from 'files-sdk/r2'
import type { H3Event } from 'h3'

import { createLocalStorage } from '../storage/local'

type StorageClient = InstanceType<typeof Files>

const requireEnv = (name: 'R2_PUBLIC_BASE_URL', event?: H3Event) => {
    const value = getRuntimeEnvString(name, event)
    if (typeof value !== 'string' || !value)
        throw new Error(
            `Missing required environment variable: ${name}. Ensure it is set before starting the server.`,
        )
    return value
}

const localStorage = import.meta.dev ? createLocalStorage('.data/uploads') : null

export const getStorage = (event?: H3Event): StorageClient => {
    if (localStorage) return localStorage

    const binding = getRuntimeEnv(event).R2 as R2Bucket | undefined
    if (!binding || typeof binding !== 'object')
        throw new Error('Missing required Cloudflare R2 binding: R2')

    // files-sdk's HTTP adapter is intentionally not configured here. Runtime
    // R2 credentials are not safe in a Worker; all reads and writes stay on
    // the native binding. The direct AWS SDK dependencies remain in
    // package.json solely for files-sdk's build-time compatibility bug.
    return new Files({
        adapter: r2({
            binding,
            publicBaseUrl: requireEnv('R2_PUBLIC_BASE_URL', event),
        }),
    })
}

export const storage = new Proxy({} as StorageClient, {
    get: (_target, property) => {
        const client = getStorage()
        const value = Reflect.get(client, property)
        return typeof value === 'function' ? value.bind(client) : value
    },
})
