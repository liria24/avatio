export default promiseEventHandler(async ({ event }) => {
    await requireAdminSession(event)
    const { result } = await runTask('job:report')
    return result
})
