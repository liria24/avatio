import type { UseFetchOptions } from 'nuxt/app'

export const useBookmarks = (
    options?: UseFetchOptions<PaginationResponse<Bookmark[]>>
) => {
    const nuxtApp = useNuxtApp()

    const defaultOptions: UseFetchOptions<PaginationResponse<Bookmark[]>> = {
        key: computed(
            () => `bookmarks-${JSON.stringify(unref(options?.query))}`
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

    return useFetch<PaginationResponse<Bookmark[]>>('/api/setups/bookmark', {
        ...defaultOptions,
        ...options,
    })
}
