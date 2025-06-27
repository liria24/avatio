import type { UseFetchOptions } from 'nuxt/app'

export const useSetups = (
    options?: UseFetchOptions<PaginationResponse<Setup[]>>
) => {
    const nuxtApp = useNuxtApp()

    const defaultOptions = {
        key: computed(() => `setups-${JSON.stringify(unref(options?.query))}`),
        getCachedData: (key: string) =>
            nuxtApp.payload.data[key] || nuxtApp.static.data[key],
        default: () => ({
            data: [],
            pagination: {
                page: 1,
                limit: 0,
                total: 0,
                totalPages: 0,
                hasPrev: false,
                hasNext: false,
            },
        }),
        dedupe: 'defer',
        lazy: false,
        immediate: true,
        headers: computed(() => {
            if (import.meta.server && nuxtApp.ssrContext?.event.headers)
                return nuxtApp.ssrContext.event.headers
        }),
    }

    return useFetch<PaginationResponse<Setup[]>>('/api/setup', {
        ...(defaultOptions as unknown as UseFetchOptions<
            PaginationResponse<Setup[]>
        >),
        ...options,
    })
}
