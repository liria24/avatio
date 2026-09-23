export default authedSessionEventHandler(async ({ event }) =>
    serverAuth(event).api.listUserAccounts({ headers: event.headers }),
)
