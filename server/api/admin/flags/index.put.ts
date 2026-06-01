export default adminSessionEventHandler(async () => {
    const body = await validateBody(appFlagsPatchSchema)
    return await updateAppFlags(body)
})
