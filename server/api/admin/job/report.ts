export default promiseEventHandler(async ({ event }) => {
    await requireUserSession(event, { user: { role: 'admin' } })
    const { result } = await runTask('job:report')
    return result
})
