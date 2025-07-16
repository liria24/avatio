import type { UseFetchOptions } from 'nuxt/app'

export const useSetup = (id: number, options?: UseFetchOptions<Setup>) => {
    const nuxtApp = useNuxtApp()

    const defaultOptions: UseFetchOptions<Setup> = {
        key: computed(
            () => `setup-${id}-${JSON.stringify(unref(options?.query))}`
        ),
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

    return useFetch<Setup>(id.toString(), {
        ...defaultOptions,
        ...options,
        baseURL: '/api/setups/',
    })
}
