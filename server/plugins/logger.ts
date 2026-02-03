export default defineNitroPlugin((nitroApp) => {
    nitroApp.hooks.hook('error', async (error, { event }) => {
        // Only output detailed logs in Vercel Preview environment
        if (process.env.VERCEL_ENV === 'preview') {
            const url = event?.path
            const method = event?.method

            console.error('[Preview Error Logger]', {
                url,
                method,
                message: error.message,
                stack: error.stack,
            })
        }
    })
})
