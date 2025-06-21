import type { MultiWatchSources } from 'vue'

interface Query {
    page?: number
    perPage?: number
    userId?: string | null
}

export const useFetchSetups = (options?: {
    query: MaybeRef<Query>
    key?: MaybeRef<string>
    dedupe?: 'cancel' | 'defer'
    lazy?: boolean
    getCachedData?: (key: string) => Setup[]
    immediate?: boolean
    watch?: false | MultiWatchSources | undefined
}) => {
    const nuxtApp = useNuxtApp()
    const {
        query,
        key = computed(() => `setups-${JSON.stringify(unref(query))}`),
        dedupe = 'defer',
        lazy = true,
        immediate = true,
        watch = undefined,
    } = options || {}

    const finalGetCachedData =
        options && 'getCachedData' in options
            ? options.getCachedData
            : (key: string) =>
                  nuxtApp.payload.data[key] || nuxtApp.static.data[key]

    const { data, status, refresh } = useFetch<PaginationResponse<Setup[]>>(
        '/api/setup',
        {
            query,
            key,
            dedupe,
            lazy,
            getCachedData: finalGetCachedData,
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
            immediate,
            watch,
        }
    )

    const setups = computed(() => data.value?.data || [])

    const hasMore = computed(() => {
        if (!data.value?.pagination) return false
        return data.value.pagination.hasNext
    })

    return {
        setups,
        hasMore,
        status,
        fetchSetups: refresh,
    }
}
