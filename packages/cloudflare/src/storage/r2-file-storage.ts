import type { FileStorage, StoredFile } from '@avatio/core'
import type { R2Bucket } from '@cloudflare/workers-types'

interface R2FileStorageOptions {
    bucket: R2Bucket
    publicBaseUrl: string
    fetch?: typeof globalThis.fetch
}

const publicFileUrl = (baseUrl: string, key: string) =>
    `${baseUrl.replace(/\/$/, '')}/${key
        .split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/')}`

export class R2FileStorage implements FileStorage {
    private readonly fetch: typeof globalThis.fetch

    constructor(private readonly options: R2FileStorageOptions) {
        this.fetch = options.fetch ?? globalThis.fetch
    }

    async importFromUrl(input: { sourceUrl: string; destinationKey: string }): Promise<StoredFile> {
        const response = await this.fetch(input.sourceUrl)
        if (!response.ok) throw new Error(`File import failed with status ${response.status}.`)

        await this.options.bucket.put(input.destinationKey, await response.arrayBuffer(), {
            httpMetadata: {
                contentType: response.headers.get('content-type') ?? undefined,
            },
        })

        return {
            key: input.destinationKey,
            url: publicFileUrl(this.options.publicBaseUrl, input.destinationKey),
        }
    }

    async delete(key: string): Promise<void> {
        await this.options.bucket.delete(key)
    }
}
