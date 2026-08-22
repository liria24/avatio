import {
    adminClient,
    inferAdditionalFields,
    multiSessionClient,
    usernameClient,
    customSessionClient,
} from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/vue'
import { withoutHost } from 'ufo'

import { hasBetterAuthSessionCookie } from '#shared/utils/authCookie'

import type { Auth } from '../../server/utils/auth'

const client = createAuthClient({
    plugins: [
        usernameClient(),
        adminClient(),
        multiSessionClient(),
        customSessionClient<Auth>(),
        inferAdditionalFields<Auth>(),
    ],
})

const _useAuth = () => {
    const localePath = useLocalePath()

    const globalSession = useState<Session | null | undefined>('auth:session', () => undefined)
    const globalSessions = useState<Sessions | undefined>('auth:sessions', () => undefined)

    const getSession = async () => {
        if (globalSession.value !== undefined) return globalSession

        const headers = useRequestHeaders()
        if (import.meta.server && !hasBetterAuthSessionCookie(headers.cookie)) {
            globalSession.value = null
            return globalSession
        }

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

    const signIn = {
        email: async (options: { email: string; password: string; callbackURL?: string }) =>
            client.signIn.email({
                email: options.email,
                password: options.password,
                callbackURL: options.callbackURL,
            }),
        twitter: async (options?: { callbackURL?: string }) =>
            client.signIn.social({
                provider: 'twitter',
                callbackURL: options?.callbackURL,
                newUserCallbackURL: localePath('/welcome'),
            }),
    }

    const signOut = async () => {
        const result = await client.signOut()
        if (result.data?.success) reloadNuxtApp()
    }

    const revoke = async () => {
        const session = await getSession()

        if (!session.value) return

        const sessions = await getSessions()
        if (sessions.value && sessions.value.length > 1) {
            const result = await client.multiSession.revoke({
                sessionToken: session.value.session.token,
            })
            if (!result.error) reloadNuxtApp()
        } else {
            const result = await client.signOut()
            if (result.data?.success) reloadNuxtApp()
        }
    }

    const returnObject = {
        auth: client,
        session: globalSession,
        sessions: globalSessions,
        getSessions,
        refreshSession,
        signIn,
        signOut,
        revoke,
    }

    // Create initialization promise that waits for the active session only.
    // Device sessions are loaded lazily by UI that needs account switching.
    const initPromise = getSession().then(() => returnObject)

    // Merge promise with return object (same pattern as Nuxt's useFetch/useAsyncData)
    const awaitableResult = Object.assign(initPromise, returnObject)

    return awaitableResult
}

export const useAuth = createSharedComposable(_useAuth)
