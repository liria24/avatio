import type { UseFetchOptions } from 'nuxt/app'

export const useBookmarks = (
    options?: UseFetchOptions<PaginationResponse<Bookmark[]>>
) => {
    const nuxtApp = useNuxtApp()

    const defaultOptions: UseFetchOptions<PaginationResponse<Bookmark[]>> = {
        key: computed(
            () => `bookmarks-${JSON.stringify(unref(options?.query))}`
        ),
        dedupe: 'defer',
        lazy: false,
        immediate: true,
        headers: computed(() => {
            if (import.meta.server && nuxtApp.ssrContext?.event.headers)
                return nuxtApp.ssrContext.event.headers
        }),
    }

    return useFetch<PaginationResponse<Bookmark[]>>('/api/setups/bookmarks', {
        ...defaultOptions,
        ...options,
    })
}
