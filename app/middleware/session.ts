export default defineNuxtRouteMiddleware(async () => {
    const { session, getSession } = useAuth()
    await getSession()
    const localePath = useLocalePath()

    if (!session.value) return navigateTo(localePath('/login'))
})
