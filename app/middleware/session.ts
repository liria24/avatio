export default defineNuxtRouteMiddleware(async () => {
    const { getSession } = useAuth()
    const localePath = useLocalePath()

    const session = await getSession()

    if (!session.value) return navigateTo(localePath('/login'))
})
