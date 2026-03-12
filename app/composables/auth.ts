import {
    adminClient,
    inferAdditionalFields,
    multiSessionClient,
    usernameClient,
} from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/vue'
import { withoutHost } from 'ufo'

const client = createAuthClient({
    plugins: [
        usernameClient(),
        adminClient(),
        multiSessionClient(),
        inferAdditionalFields<typeof auth>(),
    ],
})

const _useAuth = () => {
    const localePath = useLocalePath()

    const globalSession = useState<Session | null | undefined>('auth:session', () => undefined)
    const globalSessions = useState<Sessions | undefined>('auth:sessions', () => undefined)

    const getSession = async () => {
        if (globalSession.value !== undefined) return globalSession

        const headers = useRequestHeaders()
        const { data } = await client.useSession((url, options) =>
            useFetch(withoutHost(url), { ...options, dedupe: 'defer', headers }),
        )

        globalSession.value = data.value
        return globalSession
    }

    const refreshSession = async () => {
        const { data } = await client.getSession({ fetchOptions: { credentials: 'include' } })
        globalSession.value = data
        return globalSession
    }

    const getSessions = async () => {
        if (globalSessions.value !== undefined) return globalSessions

        const headers = useRequestHeaders()
        const { data } = await useFetch('/api/users/me/sessions', {
            dedupe: 'defer',
            headers,
            transform: (res) =>
                res?.map((r) => ({
                    ...r,
                    session: {
                        ...r.session,
                        createdAt: new Date(r.session.createdAt),
                        updatedAt: new Date(r.session.updatedAt),
                        expiresAt: new Date(r.session.expiresAt),
                    },
                    user: {
                        ...r.user,
                        createdAt: new Date(r.user.createdAt),
                        updatedAt: new Date(r.user.updatedAt),
                    },
                })) || [],
        })
        globalSessions.value = data.value

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
        email: async (email: string, password: string) => client.signIn.email({ email, password }),
        twitter: async (options?: { callbackURL?: string }) =>
            client.signIn.social({
                provider: 'twitter',
                callbackURL: options?.callbackURL,
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

    const returnObject = {
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

    // Create initialization promise that waits for session and sessions data
    const initPromise = Promise.all([getSession(), getSessions()]).then(() => returnObject)

    // Merge promise with return object (same pattern as Nuxt's useFetch/useAsyncData)
    const awaitableResult = Object.assign(initPromise, returnObject)

    // Make Promise methods enumerable
    Object.defineProperties(awaitableResult, {
        then: { enumerable: true, value: initPromise.then.bind(initPromise) },
        catch: { enumerable: true, value: initPromise.catch.bind(initPromise) },
        finally: { enumerable: true, value: initPromise.finally.bind(initPromise) },
    })

    return awaitableResult
}

export const useAuth = createSharedComposable(_useAuth)
