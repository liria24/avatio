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
}) => {
    const nuxtApp = useNuxtApp()
    const {
        query,
        key = computed(() => `setups-${JSON.stringify(unref(query))}`),
        dedupe = 'defer',
        lazy = true,
        getCachedData = (key: string) =>
            nuxtApp.payload.data[key] || nuxtApp.static.data[key],
    } = options || {}

    const { data, status, refresh } = useFetch<PaginationResponse<Setup[]>>(
        '/api/setup',
        {
            query,
            key,
            dedupe,
            lazy,
            getCachedData,
        }
    )

    const setups = computed(() => {
        return data.value?.data || []
    })

    const hasMore = computed(() => {
        if (!data.value?.pagination) return false
        return data.value.pagination.hasNext
    })

    const fetchMoreSetups = async () => {
        try {
            const currentQuery = unref(query) || {}
            const currentPage = currentQuery.page || 1
            const nextPageQuery = {
                ...currentQuery,
                page: currentPage + 1,
            }

            const moreData = await $fetch<PaginationResponse<Setup[]>>(
                '/api/setup',
                {
                    query: nextPageQuery,
                }
            )

            if (moreData?.data && data.value?.data) {
                data.value = {
                    ...data.value,
                    data: [...data.value.data, ...moreData.data],
                    pagination: moreData.pagination,
                }

                const queryValue = unref(query)
                if (isRef(query)) {
                    query.value = { ...queryValue, page: currentPage + 1 }
                } else if (queryValue && typeof queryValue === 'object') {
                    Object.assign(queryValue, { page: currentPage + 1 })
                }
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
