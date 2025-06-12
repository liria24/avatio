interface Query {
    page?: number
    perPage?: number
    userId?: string | null
}

export const useFetchSetups = (
    type: MaybeRef<'latest' | 'user' | 'bookmarks'> = 'latest',
    options?: {
        query: MaybeRef<Query>
        key?: MaybeRef<string>
        dedupe?: 'cancel' | 'defer'
        lazy?: boolean
        getCachedData?: (key: string) => SetupClient[]
    }
) => {
    const nuxtApp = useNuxtApp()
    const {
        query,
        key = computed(() => `setups-${unref(type)}-${unref(query)}`),
        dedupe = 'defer',
        lazy = true,
        getCachedData = (key: string) =>
            nuxtApp.payload.data[key] || nuxtApp.static.data[key],
    } = options || {}

    const routes = {
        latest: '/api/setup/latest',
        user: '/api/setup/user',
        bookmarks: '/api/setup/bookmarks',
    }

    interface ResponseData {
        setups: SetupClient[]
        hasMore: boolean
    }

    const fetchOptions = {
        query,
        key,
        dedupe,
        lazy,
        getCachedData,
        default: () => ({
            setups: [],
            hasMore: false,
        }),
    }

    const { data, status, refresh } = useFetch<ResponseData>(
        computed(() => routes[unref(type)]),
        fetchOptions
    )

    const setups = computed(() => {
        return data.value?.setups || []
    })
    const hasMore = computed(() => data.value?.hasMore || false)

    const fetchMoreSetups = async () => {
        try {
            const currentQuery = unref(query) || {}
            const currentPage = currentQuery.page || 1
            const nextPageQuery = {
                ...currentQuery,
                page: currentPage + 1,
            }

            const moreData = await $fetch<ResponseData>(routes[unref(type)], {
                query: nextPageQuery,
            })

            if (moreData && data.value) {
                // 既存の配列に新しいデータを追加
                data.value.setups = [...data.value.setups, ...moreData.setups]
                data.value.hasMore = moreData.hasMore

                // クエリのページ番号も更新
                if (query && typeof query === 'object' && 'page' in query)
                    query.page = currentPage + 1
            }

            return moreData
        } catch (error) {
            console.error('Failed to fetch more setups:', error)
            throw createError({
                statusCode: 500,
                statusMessage: 'Failed to fetch more setups',
            })
        }
    }

    return {
        setups,
        hasMore,
        status,
        fetchSetups: refresh,
        fetchMoreSetups,
    }
}
