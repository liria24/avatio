export default defineNitroPlugin(async () => {
    if (!import.meta.dev) return

    const { initializeLocalRuntime } = await import('../utils/localRuntime')
    initializeLocalRuntime()
})
