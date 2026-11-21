export default authedSessionEventHandler(async ({ event, session }) => {
    applyNoStoreCache(event)
    return { enabled: await canUseSetupItemPoints(event, session.user) }
})
