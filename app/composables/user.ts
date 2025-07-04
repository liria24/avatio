import type { UseFetchOptions } from 'nuxt/app'

export const useUser = (
    id: string,
    options?: UseFetchOptions<UserWithSetups>
) => {
    const nuxtApp = useNuxtApp()

    const defaultOptions: UseFetchOptions<UserWithSetups> = {
        key: computed(() => `user-${unref(id)}`),
        getCachedData: (key: string) =>
            nuxtApp.payload.data[key] || nuxtApp.static.data[key],
        dedupe: 'defer',
        lazy: false,
        immediate: true,
        headers: computed(() => {
            if (import.meta.server && nuxtApp.ssrContext?.event.headers)
                return nuxtApp.ssrContext.event.headers
        }),
    }

    return useFetch<UserWithSetups>(id, {
        ...defaultOptions,
        ...options,
        baseURL: '/api/users/',
    })
}
