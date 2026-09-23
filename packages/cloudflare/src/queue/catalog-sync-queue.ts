import type { CatalogSyncMessage, CatalogSyncQueue } from '@avatio/core/catalog'
import type { Queue } from '@cloudflare/workers-types'

export class CloudflareCatalogSyncQueue implements CatalogSyncQueue {
    constructor(private readonly queue: Queue<CatalogSyncMessage>) {}

    async enqueue(message: CatalogSyncMessage): Promise<void> {
        await this.queue.send(message)
    }
}
