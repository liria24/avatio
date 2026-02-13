export default defineNuxtRouteMiddleware(async () => {
    const { getSession, getSessions } = useAuth()
    await Promise.all([getSession(), getSessions()])
})
