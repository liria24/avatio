import type { z } from 'zod'

export const useUserSettings = () =>
    useFetch('/api/users/me/settings', {
        key: 'user-settings',
        dedupe: 'defer',
        lazy: false,
        immediate: true,
        default: () => ({
            updatedAt: null,
            showPrivateSetups: true,
            showNSFW: false,
        }),
    })

export const useUserSettingsUpdate = () => {
    const update = (
        body: z.infer<typeof userSettingsUpdateSchema>,
        options?: Omit<Parameters<typeof $fetch<unknown, '/api/users/me/settings'>>[1], 'body'>,
    ) => $fetch('/api/users/me/settings', { method: 'PUT', ...options, body })

    return { update }
}
