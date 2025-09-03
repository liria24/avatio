import type { UseFetchOptions } from 'nuxt/app'

export const useUser = (id: string, options?: UseFetchOptions<User>) => {
    const nuxtApp = useNuxtApp()

    const defaultOptions: UseFetchOptions<User> = {
        key: computed(() => `user-${unref(id)}`),
        dedupe: 'defer',
        lazy: false,
        immediate: true,
        headers: computed(() => {
            if (import.meta.server && nuxtApp.ssrContext?.event.headers)
                return nuxtApp.ssrContext.event.headers
        }),
    }

    return useFetch<User>(id, {
        ...defaultOptions,
        ...options,
        baseURL: '/api/users/',
    })
}
