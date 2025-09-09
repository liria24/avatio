import type { UseFetchOptions } from 'nuxt/app'

export const useBookmarks = (
    options?: UseFetchOptions<PaginationResponse<Bookmark[]>>
) => {
    const defaultOptions: UseFetchOptions<PaginationResponse<Bookmark[]>> = {
        key: computed(
            () => `bookmarks-${JSON.stringify(unref(options?.query))}`
        ),
        dedupe: 'defer',
        lazy: false,
        immediate: true,
    }

    return useFetch<PaginationResponse<Bookmark[]>>('/api/setups/bookmarks', {
        ...defaultOptions,
        ...options,
    })
}
