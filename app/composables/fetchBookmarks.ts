interface Query {
    page?: number
    perPage?: number
    userId?: string | null
}

export const useFetchBookmarks = (options?: {
    query: MaybeRef<Query>
    key?: MaybeRef<string>
    dedupe?: 'cancel' | 'defer'
    lazy?: boolean
    getCachedData?: (key: string) => Bookmark[]
    immediate?: boolean
}) => {
    const nuxtApp = useNuxtApp()
    const {
        query,
        key = computed(() => `bookmarks-${JSON.stringify(unref(query))}`),
        dedupe = 'defer',
        lazy = true,
        immediate = true,
    } = options || {}

    const finalGetCachedData =
        options && 'getCachedData' in options
            ? options.getCachedData
            : (key: string) =>
                  nuxtApp.payload.data[key] || nuxtApp.static.data[key]

    const { data, status, refresh } = useFetch<PaginationResponse<Bookmark[]>>(
        '/api/setup/bookmark',
        {
            query,
            key,
            dedupe,
            lazy,
            getCachedData: finalGetCachedData,
            immediate,
            watch: false,
        }
    )

    const bookmarks = computed(() => data.value?.data || [])

    const hasMore = computed(() => {
        if (!data.value?.pagination) return false
        return data.value.pagination.hasNext
    })

    return {
        bookmarks,
        hasMore,
        status,
        fetchBookmarks: refresh,
    }
}
