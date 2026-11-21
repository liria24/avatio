export default authedSessionEventHandler(async ({ event, services }) => {
    applyNoStoreCache(event)
    return { enabled: await canUseSetupItemPoints(services) }
})
