export default defineNuxtRouteMiddleware(async () => {
    const { $authClient } = useNuxtApp()
    const localePath = useLocalePath()

    const { data: session } = await $authClient.useSession((url, options) =>
        useFetch(url, { ...options, dedupe: 'defer' })
    )

    if (!session.value) return navigateTo(localePath('/login'))
})
