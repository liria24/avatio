export const useChangelogs = (options?: { query?: MaybeRef<Record<string, unknown>> }) => {
    const page = ref(1)
    const cacheKey = computed(
        () => `changelogs-state-${JSON.stringify(unref(options?.query) || {})}`,
    )
    const changelogs = useState<Changelog[]>(cacheKey.value, () => [])

    const queryParams = computed(() => {
        const base: Record<string, unknown> = {
            page: page.value,
            ...(unref(options?.query) || {}),
        }
        return base
    })

    const { data, error, status, refresh } = useFetch<PaginationResponse<Changelog[]>>(
        '/api/changelogs',
        {
            key: computed(() => `changelogs-fetch-${JSON.stringify(queryParams.value)}`),
            query: queryParams,
            dedupe: 'defer',
            onResponse({ response }) {
                if (response._data?.data) {
                    if (page.value === 1) changelogs.value = response._data.data
                    else changelogs.value = [...changelogs.value, ...response._data.data]
                }
            },
        },
    )

    const initialize = async () => {
        page.value = 1
        await refresh()
    }

    const loadMore = async () => {
        if (data.value?.pagination.hasNext) {
            page.value += 1
            await refresh()
        }
    }

    const refreshData = async () => {
        page.value = 1
        await refresh()
    }

    return {
        changelogs,
        error,
        status,
        pagination: computed(() => data.value?.pagination),
        initialize,
        loadMore,
        refresh: refreshData,
    }
}

export const useChangelogTitles = (options?: { query?: MaybeRef<Record<string, unknown>> }) => {
    const queryParams = computed(() => ({
        ...(unref(options?.query) || {}),
    }))

    const { data, status, refresh } = useFetch('/api/changelogs', {
        key: computed(() => `changelog-titles-${JSON.stringify(queryParams.value)}`),
        query: queryParams,
        dedupe: 'defer',
        transform: (response) => response.data.map((item) => item.title),
        default: () => [],
    })

    return {
        titles: data,
        status,
        refresh,
    }
}
