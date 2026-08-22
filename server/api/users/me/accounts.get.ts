export default authedSessionEventHandler(async ({ event }) =>
    getAuth(event).api.listUserAccounts({ headers: event.headers }),
)
