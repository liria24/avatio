export default defineNuxtRouteMiddleware(async () => {
    const { session } = await useAuth()
    const localePath = useLocalePath()

    if (!session.value) return navigateTo(localePath('/login'))
})
