import { emails } from '@@/database/schema'

const log = logger('cloudflare:email')

interface RawEmailReader {
    read(): Promise<{ done: boolean; value?: Uint8Array }>
    releaseLock(): void
}

interface RawEmailStream {
    getReader(): RawEmailReader
}

const readRawEmail = async (stream: RawEmailStream) => {
    const reader = stream.getReader()
    const chunks: Uint8Array[] = []

    try {
        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            if (value) chunks.push(value)
        }
    } finally {
        reader.releaseLock()
    }

    const size = chunks.reduce((total, chunk) => total + chunk.byteLength, 0)
    const raw = new Uint8Array(size)
    let offset = 0

    for (const chunk of chunks) {
        raw.set(chunk, offset)
        offset += chunk.byteLength
    }

    return raw.buffer
}

export default defineNitroPlugin((nitroApp) => {
    nitroApp.hooks.hook('cloudflare:email', async ({ message }) => {
        const raw = await readRawEmail(message.raw)
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
