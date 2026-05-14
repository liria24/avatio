export default defineNuxtRouteMiddleware(async () => {
    const { session } = await useAuth()
    const localePath = useLocalePath()

    if (!session.value) return navigateTo(localePath('/login'))
    if (session.value.user.role !== 'admin')
        return showError({ status: 404, statusText: 'Page Not Found' })
})
