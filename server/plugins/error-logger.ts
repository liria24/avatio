export default defineNitroPlugin((nitro) => {
    nitro.hooks.hook('error', async (error) => {
        console.error(error)
    })
})
