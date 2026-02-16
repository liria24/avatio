import {
    adminClient,
    customSessionClient,
    inferAdditionalFields,
    multiSessionClient,
    usernameClient,
} from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/vue'

const client = createAuthClient({
    baseURL: import.meta.env.PUBLIC_SITE_URL as string,
    plugins: [
        usernameClient(),
        adminClient(),
        multiSessionClient(),
        customSessionClient<typeof auth>(),
        inferAdditionalFields<typeof auth>(),
    ],
})

export const useAuth = () => {
    const localePath = useLocalePath()

    const globalSession = useState<Session | null | undefined>('auth:session', () => undefined)
    const globalSessions = useState<Sessions | undefined>('auth:sessions', () => undefined)

    const getSession = async () => {
        if (globalSession.value !== undefined) return globalSession

        const headers = useRequestHeaders()
        const { data } = await client.useSession((url, options) =>
            useFetch(url, { ...options, dedupe: 'defer', headers }),
        )

        globalSession.value = data.value
        return globalSession
    }

    const refreshSession = async () => {
        const headers = useRequestHeaders()
        const { data } = await client.useSession((url, options) =>
            useFetch(url, {
                ...options,
                dedupe: 'defer',
                credentials: 'include',
                headers,
            }),
        )

        globalSession.value = data.value
        return globalSession
    }

    const getSessions = async () => {
        if (globalSessions.value !== undefined) return globalSessions

        try {
            const { data } = await client.multiSession.listDeviceSessions()
            globalSessions.value = data || []
        } catch {
            globalSessions.value = undefined
        }

        return globalSessions
    }

    const refreshSessions = async () => {
        try {
            const { data } = await client.multiSession.listDeviceSessions()
            globalSessions.value = data || []
        } catch {
            globalSessions.value = undefined
        }

        return globalSessions
    }

    const signIn = {
        twitter: async () =>
            client.signIn.social({
                provider: 'twitter',
                newUserCallbackURL: localePath('/welcome'),
            }),
    }

    const signOut = async () => {
        const localePath = useLocalePath()

        const result = await client.signOut()
        if (result.data?.success) navigateTo(localePath('/'), { external: true })
    }

    const revoke = async () => {
        const localePath = useLocalePath()
        const session = await getSession()

        if (!session.value) return

        const sessions = await getSessions()
        if (sessions.value && sessions.value.length > 1) {
            const result = await client.multiSession.revoke({
                sessionToken: session.value.session.token,
            })
            if (!result.error) navigateTo(localePath('/'), { external: true })
        } else {
            const result = await client.signOut()
            if (result.data?.success) navigateTo(localePath('/'), { external: true })
        }
    }

    return {
        auth: client,
        session: globalSession,
        sessions: globalSessions,
        getSession,
        getSessions,
        refreshSession,
        refreshSessions,
        signIn,
        signOut,
        revoke,
    }
}
