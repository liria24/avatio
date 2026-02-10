export default defineNuxtRouteMiddleware(async () => {
    const { session, getSession } = useAuth()
    await getSession()
    const localePath = useLocalePath()

    if (session.value?.user?.role !== 'admin') return navigateTo(localePath('/login'))
})
