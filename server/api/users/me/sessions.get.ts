export default sessionEventHandler(async ({ event, session }) => {
    if (!session) return null
    return await serverAuth(event).api.listDeviceSessions({ headers: event.headers })
})
