export const useFetchSetup = (
    id: MaybeRef<number>,
    options?: {
        key?: MaybeRef<string>
        dedupe?: 'cancel' | 'defer'
        lazy?: boolean
        getCachedData?: (key: string) => Setup | undefined
    }
) => {
    const nuxtApp = useNuxtApp()
    const {
        key = computed(() => `setup-${unref(id)}`),
        dedupe = 'defer',
        lazy = true,
    } = options || {}

    const finalGetCachedData =
        options && 'getCachedData' in options
            ? options.getCachedData // 明示的にundefinedが渡された場合もそのまま使用
            : (key: string) =>
                  nuxtApp.payload.data[key] || nuxtApp.static.data[key] // プロパティが省略された場合のデフォルト

    const { data, status, refresh } = useFetch<Setup>(
        `/api/setup/${unref(id)}`,
        { key, dedupe, lazy, getCachedData: finalGetCachedData }
    )

    return { setup: data, status, fetchSetup: refresh }
}
