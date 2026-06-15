import type { MessageBatch } from '@cloudflare/workers-types'
import type { ItemRevalidationMessage } from '../utils/itemRevalidationQueue'

const log = logger('itemRevalidationQueue')

export default defineNitroPlugin((nitroApp) => {
    nitroApp.hooks.hook(
        'cloudflare:queue',
        async ({ batch }: { batch: MessageBatch<ItemRevalidationMessage> }) => {
            if (batch.queue !== 'item-revalidation') return

            for (const message of batch.messages)
                try {
                    await handleItemRevalidationMessage(message.body)
                    message.ack()
                } catch (error) {
                    log.error('Failed to revalidate item from queue:', error)
                    message.retry()
                }
        },
    )
})
