export default defineNuxtRouteMiddleware(async () => {
    const { session } = await useAuth()
    const localePath = useLocalePath()

    if (session.value?.user?.role !== 'admin') return navigateTo(localePath('/login'))
})
