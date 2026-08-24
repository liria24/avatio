import type { AuthSession, AuthUser } from '#nuxt-better-auth'

export interface DeviceSession {
    session: AuthSession
    user: AuthUser
}

const normalizeDeviceSessions = (sessions: DeviceSession[]) =>
    sessions.map((entry) => ({
        ...entry,
        session: {
            ...entry.session,
            createdAt: new Date(entry.session.createdAt),
            updatedAt: new Date(entry.session.updatedAt),
            expiresAt: new Date(entry.session.expiresAt),
        },
        user: {
            ...entry.user,
            createdAt: new Date(entry.user.createdAt),
            updatedAt: new Date(entry.user.updatedAt),
        },
    }))

export const useDeviceSessions = () => {
    const client = useAuthClient()
    const asyncData = useAsyncData<DeviceSession[]>(
        'auth:device-sessions',
        async () => normalizeDeviceSessions(await $fetch('/api/users/me/sessions')),
        { immediate: false },
    )

    const requireClient = () => {
        if (!client) throw new Error('Device session actions are only available in the browser.')
        return client
    }

    return {
        data: asyncData.data,
        error: asyncData.error,
        status: asyncData.status,
        pending: asyncData.pending,
        clear: asyncData.clear,
        execute: asyncData.execute,
        refresh: asyncData.refresh,
        load: async () => {
            if (asyncData.status.value === 'idle') await asyncData.execute()
            else await asyncData.refresh()
        },
        setActive: async (sessionToken: string) => {
            await requireClient().multiSession.setActive({ sessionToken })
        },
        revokeOtherSessions: async () => {
            await requireClient().revokeOtherSessions()
            await asyncData.refresh()
        },
    }
}
