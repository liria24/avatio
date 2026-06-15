import type { MessageBatch } from '@cloudflare/workers-types'

const log = logger('itemRevalidationQueue')

export default defineNitroPlugin((nitroApp) => {
    nitroApp.hooks.hook('cloudflare:queue', async ({ batch }: { batch: MessageBatch<unknown> }) => {
        if (batch.queue !== 'item-revalidation') return

        for (const message of batch.messages)
            try {
                await handleItemRevalidationMessage(message.body as ItemRevalidationMessage)
                message.ack()
            } catch (error) {
                log.error('Failed to revalidate item from queue:', error)
                message.retry()
            }
    })
})
