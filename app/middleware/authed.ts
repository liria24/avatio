export default defineNuxtRouteMiddleware(async () => {
    const { session } = useAuth()
    const localePath = useLocalePath()

    if (!session.value) return navigateTo(localePath('/login'))
})
