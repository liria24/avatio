export default authedSessionEventHandler(async ({ event }) =>
    auth.api.listDeviceSessions({ headers: event.headers }),
)
