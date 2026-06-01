export default adminSessionEventHandler(async ({ event }) => {
    const { dryRun: dryRunParam } = getQuery(event)
    const dryRun = dryRunParam === 'true' || dryRunParam === '1'

    const { result } = await runTask('job:cleanup', { payload: { dryRun } })
    return result
})
