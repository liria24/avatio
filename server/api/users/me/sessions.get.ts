export default sessionEventHandler(async ({ event, session }) => {
    if (!session) return null
    return await auth.api.listDeviceSessions({ headers: event.headers })
})
