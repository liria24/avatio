const log = logger('itemRevalidationQueue')

export default defineNitroPlugin((nitroApp) => {
    nitroApp.hooks.hook('cloudflare:queue', async ({ batch, context }) => {
        for (const message of batch.messages)
            try {
                await handleItemRevalidationMessage(
                    message.body as ItemRevalidationMessage,
                    context.cache,
                )
                message.ack()
            } catch (error) {
                log.error('Failed to revalidate item from queue:', error)
                message.retry()
            }
    })
})
