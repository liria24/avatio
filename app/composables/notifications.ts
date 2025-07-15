import type { Notification } from '@@/shared/types'
import type { UseFetchOptions } from 'nuxt/app'

type Options = UseFetchOptions<{
    data: Notification[]
    unread: number
}>

export const useNotifications = (options?: Options) => {
    const nuxtApp = useNuxtApp()

    const defaultOptions = {
        key: computed(
            () => `notifications-${JSON.stringify(unref(options?.query))}`
        ),
        default: () => ({
            data: [],
            unread: 0,
            read: 0,
        }),
        dedupe: 'defer',
        lazy: true,
        immediate: true,
        headers: computed(() => {
            if (import.meta.server && nuxtApp.ssrContext?.event.headers)
                return nuxtApp.ssrContext.event.headers
        }),
    }

    return useFetch('/api/notifications', {
        ...(defaultOptions as unknown as Options),
        ...options,
        method: 'GET',
    })
}
