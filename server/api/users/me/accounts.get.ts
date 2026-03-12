export default authedSessionEventHandler(async ({ event }) =>
    auth.api.listUserAccounts({ headers: event.headers }),
)
