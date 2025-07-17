export default defineNitroPlugin((nitro) => {
    nitro.hooks.hook('render:response', async (response, { event }) => {
        const acceptsEncoding = getRequestHeader(
            event,
            'accept-encoding'
        )?.includes('gzip')
        if (acceptsEncoding) {
            setResponseHeader(event, 'Content-Encoding', 'gzip')
            response.body = new Response(response.body).body?.pipeThrough(
                new CompressionStream('gzip')
            )
        }
    })
})
