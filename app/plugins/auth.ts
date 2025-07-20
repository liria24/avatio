import type { auth } from '@@/better-auth'
import {
    adminClient,
    customSessionClient,
    multiSessionClient,
} from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/vue'

export default defineNuxtPlugin(() => {
    const client = createAuthClient({
        baseURL: import.meta.env.NUXT_BETTER_AUTH_URL as string,
        plugins: [
            adminClient(),
            multiSessionClient(),
            customSessionClient<typeof auth>(),
        ],
    })

    return {
        provide: {
            authClient: client,

            session: async () => {
                const { data: session } = await client.useSession(
                    (url, options) =>
                        useFetch(url, { ...options, dedupe: 'defer' })
                )
                return session
            },

            sessions: async () => {
                const sessions = await client.listSessions()
                return sessions
            },

            multiSession: async () => {
                const { data: sessions } =
                    await client.multiSession.listDeviceSessions()
                return sessions || []
            },

            login: async (provider: 'twitter') =>
                await client.signIn.social({ provider }),

            logout: async () => {
                const localePath = useLocalePath()
                const toast = useToast()

                const result = await client.signOut()
                if (result.data?.success) {
                    toast.add({
                        title: 'ログアウトしました',
                        description: 'ページを更新しています...',
                        progress: false,
                    })
                    navigateTo(localePath('/'), { external: true })
                }
            },

            revoke: async () => {
                const localePath = useLocalePath()
                const toast = useToast()
                const session = await client.getSession()

                if (!session.data?.session) return

                const result = await client.multiSession.revoke({
                    sessionToken: session.data?.session.token,
                })
                if (!result.error) {
                    toast.add({
                        title: 'ログアウトしました',
                        description: 'ページを更新しています...',
                        progress: false,
                    })
                    navigateTo(localePath('/'), { external: true })
                }
            },
        },
    }
})
