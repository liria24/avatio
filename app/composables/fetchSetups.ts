interface Query {
    page?: number
    perPage?: number
}

export const useFetchSetups = (
    type: 'latest' | 'user' | 'bookmark' = 'latest',
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
        key = computed(() => `setups-${type}-${unref(query)}`),
        dedupe = 'defer',
        lazy = true,
        getCachedData = (key: string) =>
            nuxtApp.payload.data[key] || nuxtApp.static.data[key],
    } = options || {}

    const { data, status, refresh } = useFetch('/api/setup/latest', {
        query,
        key,
        dedupe,
        lazy,
        getCachedData,
        default: () => [],
    })

    return { setups: data, status, fetchSetups: refresh }
}
