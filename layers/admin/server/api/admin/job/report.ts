export default promiseEventHandler(async ({ event }) => {
    await requireAdminJobRequest(event)
    const { result } = await runTask('job:report')
    return result
})
