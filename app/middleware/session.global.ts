export default defineNuxtRouteMiddleware(async () => {
    const { getSession } = useAuth()
    await getSession()
})
