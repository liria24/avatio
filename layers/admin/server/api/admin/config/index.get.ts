export default promiseEventHandler(async ({ db, event }) => {
    await requireAdminSession(event)
    return readAppConfig(db, event)
})
