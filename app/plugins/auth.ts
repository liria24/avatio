import {
    adminClient,
    customSessionClient,
    inferAdditionalFields,
    multiSessionClient,
    usernameClient,
} from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/vue'

export default defineNuxtPlugin(() => {
    const client = createAuthClient({
        baseURL: import.meta.env.NUXT_BETTER_AUTH_URL as string,
        plugins: [
            usernameClient(),
            adminClient(),
            multiSessionClient(),
            customSessionClient<typeof auth>(),
            inferAdditionalFields<typeof auth>(),
        ],
    })

    type Session = typeof client.$Infer.Session

    const globalSession = useState<Session | null | undefined>(
        'auth:session',
        () => undefined
    )

    return {
        provide: {
            authClient: client,

            session: async () => {
                if (globalSession.value !== undefined) return globalSession

                const { data: session } = await client.useSession(useFetch)

                globalSession.value = session.value
                return session
            },

            refreshSession: async () => {
                const { data: session } = await client.useSession(
                    (url, options) =>
                        useFetch(url, { ...options, dedupe: 'defer' })
                )

                // グローバルステートを更新
                globalSession.value = session.value
                return session
            },

            sessions: async () => {
                const sessions = await client.listSessions()
                return sessions
            },

            multiSession: async () => {
                try {
                    const { data: sessions } =
                        await client.multiSession.listDeviceSessions()
                    return sessions || []
                } catch {
                    // console.error('Error fetching multi-session:', error)
                    return []
                }
            },

            login: async (provider: 'twitter') =>
                await client.signIn.social({
                    provider,
                    newUserCallbackURL: '/welcome',
                }),

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
