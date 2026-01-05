export default defineNuxtRouteMiddleware(async () => {
    const { getSession } = useAuth()
    const localePath = useLocalePath()

    const session = await getSession()

    if (session.value?.user?.role !== 'admin') return navigateTo(localePath('/login'))
})
