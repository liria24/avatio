import type { UseFetchOptions } from 'nuxt/app'

export const useSetup = (id: number, options?: UseFetchOptions<SerializedSetup>) => {
    const defaultOptions: UseFetchOptions<SerializedSetup> = {
        key: computed(() => `setup-${id}-${JSON.stringify(unref(options?.query))}`),
        dedupe: 'defer',
        lazy: false,
        immediate: true,
    }

    return useFetch<SerializedSetup>(id.toString(), {
        ...defaultOptions,
        ...options,
        baseURL: '/api/setups/',
    })
}

export const useSetupsList = (
    type?: 'latest' | 'owned' | 'bookmarked',
    options?: {
        username?: string
        query?: MaybeRef<Record<string, unknown>>
        immediate?: boolean
        watch?: UseFetchOptions<unknown>['watch']
    },
) => {
    const page = ref(1)
    const cacheKey = computed(
        () =>
            `setups-state-${type || 'custom'}-${options?.username || ''}-${JSON.stringify(unref(options?.query) || {})}`,
    )
    const setups = useState<SerializedSetup[]>(cacheKey.value, () => [])

    // Build query parameters
    const queryParams = computed(() => {
        const base: Record<string, unknown> = {
            page: page.value,
            ...(unref(options?.query) || {}),
        }

        // typeが指定されている場合のみ、デフォルトのlimitを設定
        if (type) {
            // limitが明示的に指定されていない場合のみデフォルト値を使用
            if (!base.limit) {
                base.limit =
                    type === 'latest'
                        ? LATEST_SETUPS_LIST_PER_PAGE
                        : type === 'owned'
                          ? USER_SETUPS_LIST_PER_PAGE
                          : BOOKMARKS_LIST_PER_PAGE
            }

            // Add username for owned type
            if (type === 'owned' && options?.username) base.username = options.username

            // Add bookmarked flag for bookmarked type
            if (type === 'bookmarked') base.bookmarked = true
        }

        return base
    })

    // Fetch data - 常に /api/setups を使用
    const { data, status, refresh } = useFetch<PaginationResponse<SerializedSetup[]>>(
        '/api/setups',
        {
            key: computed(
                () => `setups-fetch-${type || 'custom'}-${JSON.stringify(queryParams.value)}`,
            ),
            query: queryParams,
            dedupe: 'defer',
            lazy: false,
            immediate: options?.immediate !== false,
            ...(options?.watch !== undefined ? { watch: options.watch } : {}),
            onResponse({ response }) {
                if (response._data?.data) {
                    if (page.value === 1) setups.value = response._data.data
                    else setups.value = [...setups.value, ...response._data.data]
                }
            },
        },
    )

    // Initialize: Load initial data
    const initialize = async () => {
        page.value = 1
        await refresh()
    }

    // Load more: Append next page data
    const loadMore = async () => {
        if (data.value?.pagination.hasNext) {
            page.value += 1
            await refresh()
        }
    }

    // Refresh: Reset to first page
    const refreshData = async () => {
        page.value = 1
        await refresh()
    }

    return {
        setups,
        status,
        pagination: computed(() => data.value?.pagination),
        initialize,
        loadMore,
        refresh: refreshData,
    }
}
