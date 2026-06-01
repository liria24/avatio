export default adminSessionEventHandler(async () => {
    const { result } = await runTask('job:report')
    return result
})
