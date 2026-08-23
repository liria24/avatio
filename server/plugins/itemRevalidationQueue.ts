import type { Message } from '@cloudflare/workers-types'

const log = logger('itemRevalidationQueue')
const MAX_PURGE_TAGS = 100

export default defineNitroPlugin((nitroApp) => {
    nitroApp.hooks.hook('cloudflare:queue', async ({ batch, context }) => {
        if (batch.queue !== 'item-revalidation') return

        const results = await Promise.allSettled(
            batch.messages.map((message) =>
                handleItemRevalidationMessage(message.body as ItemRevalidationMessage),
            ),
        )

        const tags = new Set<string>()
        const succeeded: Message<unknown>[] = []

        results.forEach((result, index) => {
            const message = batch.messages[index]
            if (!message) return

            if (result.status === 'rejected') {
                log.error('Failed to revalidate item from queue:', result.reason)
                message.retry()
                return
            }

            succeeded.push(message)

            for (const tag of result.value) tags.add(tag)
        })

        if (context.cache && tags.size) {
            const allTags = [...tags]

            for (let i = 0; i < allTags.length; i += MAX_PURGE_TAGS)
                try {
                    await purgeEdgeCacheTagsWithContext(
                        context.cache,
                        allTags.slice(i, i + MAX_PURGE_TAGS),
                        'item revalidation batch',
                    )
                } catch (error) {
                    log.error('Failed to purge revalidation batch cache:', error)
                }
        }

        for (const message of succeeded) message.ack()
    })
})
