import { emails } from '@@/database/schema'

const log = logger('cloudflare:email')

export default defineNitroPlugin((nitroApp) => {
    nitroApp.hooks.hook('cloudflare:email', async ({ message }) => {
        // @ts-expect-error - Workers and DOM declare incompatible stream types at build time.
        const raw = await new Response(message.raw).arrayBuffer()
        const row = await parseInboundEmail({
            from: message.from,
            to: message.to,
            headers: message.headers,
            raw,
            rawSize: message.rawSize,
        })

        await useDB().insert(emails).values(row).onConflictDoNothing()
        log.info(`Stored inbound email ${row.messageId}`)
    })
})
