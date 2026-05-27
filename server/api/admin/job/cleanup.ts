export default cronEventHandler(async ({ event }) => {
    const { dryRun: dryRunParam } = getQuery(event)
    const dryRun = dryRunParam === 'true' || dryRunParam === '1'

    return await runCleanupJob({ dryRun })
})
