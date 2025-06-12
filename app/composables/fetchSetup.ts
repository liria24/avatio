export const useFetchSetup = (
    id: MaybeRef<number>,
    options?: {
        key?: MaybeRef<string>
        dedupe?: 'cancel' | 'defer'
        lazy?: boolean
        getCachedData?: (key: string) => SetupClient
    }
) => {
    const nuxtApp = useNuxtApp()
    const {
        key = computed(() => `setup-${unref(id)}`),
        dedupe = 'defer',
        lazy = true,
        getCachedData = (key: string) =>
            nuxtApp.payload.data[key] || nuxtApp.static.data[key],
    } = options || {}

    const { data, status, refresh } = useFetch<SetupClient>(
        `/api/setup/${unref(id)}`,
        { key, dedupe, lazy, getCachedData }
    )

    return { setup: data, status, fetchSetup: refresh }
}
