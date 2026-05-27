const log = logger('cloudflare:scheduled')

export default defineNitroPlugin((nitroApp) => {
    nitroApp.hooks.hook('cloudflare:scheduled', async ({ controller }) => {
        if (controller.cron !== '0 22 * * *') return

        try {
            await Promise.all([runReportJob(), runCleanupJob()])
        } catch (error) {
            log.error('Scheduled job failed:', error)
            throw error
        }
    })
})
