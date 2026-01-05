import type { Notification } from '@@/shared/types'
import type { UseFetchOptions } from 'nuxt/app'

type Options = UseFetchOptions<{
    data: Notification[]
    unread: number
}>

export const useNotifications = (options?: Options) => {
    const defaultOptions = {
        key: computed(() => `notifications-${JSON.stringify(unref(options?.query))}`),
        default: () => ({
            data: [],
            unread: 0,
            read: 0,
        }),
        dedupe: 'defer',
        lazy: true,
        immediate: true,
    }

    return useFetch('/api/notifications', {
        ...(defaultOptions as unknown as Options),
        ...options,
        method: 'GET',
    })
}
