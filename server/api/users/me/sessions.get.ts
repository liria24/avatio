export default sessionEventHandler(async ({ event, session }) => {
    if (!session) return null
    return await getAuth(event).api.listDeviceSessions({ headers: event.headers })
})
