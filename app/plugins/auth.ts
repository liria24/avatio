import { adminClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/vue'

export default defineNuxtPlugin(() => {
    const client = createAuthClient({
        baseURL: import.meta.env.NUX_PUBLIC_SITE_URL,
        plugins: [adminClient()],
    })

    return {
        provide: {
            authClient: client,
            login: async (provider: 'github' | 'twitter') =>
                await client.signIn.social({ provider }),
            logout: async () => {
                const localePath = useLocalePath()
                const result = await client.signOut()
                if (result.data?.success) {
                    const session = await useGetSession()
                    session.value = null
                    navigateTo(localePath('/'))
                }
            },
        },
    }
})
