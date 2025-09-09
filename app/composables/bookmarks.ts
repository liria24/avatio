import type { UseFetchOptions } from 'nuxt/app'

export const useBookmarks = (
    options?: UseFetchOptions<PaginationResponse<SerializedBookmark[]>>
) => {
    const defaultOptions: UseFetchOptions<
        PaginationResponse<SerializedBookmark[]>
    > = {
        key: computed(
            () => `bookmarks-${JSON.stringify(unref(options?.query))}`
        ),
        dedupe: 'defer',
        lazy: false,
        immediate: true,
    }

    return useFetch<PaginationResponse<SerializedBookmark[]>>(
        '/api/setups/bookmarks',
        {
            ...defaultOptions,
            ...options,
        }
    )
}
