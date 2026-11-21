export default defineTask({
    meta: {
        name: 'job:cleanup',
        description: 'Clean up unused images from R2 storage',
    },
    async run({ payload }) {
        const dryRun =
            payload?.dryRun === true || payload?.dryRun === 'true' || payload?.dryRun === '1'
        const result = await runCleanupJob({ dryRun })
        return { result }
    },
})
