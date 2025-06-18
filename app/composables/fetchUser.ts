export const useFetchUser = (
    id: MaybeRef<string>,
    options?: {
        key?: MaybeRef<string>
        dedupe?: 'cancel' | 'defer'
        lazy?: boolean
        getCachedData?: (key: string) => UserWithSetups | undefined
    }
) => {
    const nuxtApp = useNuxtApp()
    const {
        key = computed(() => `user-${unref(id)}`),
        dedupe = 'defer',
        lazy = true,
    } = options || {}

    const finalGetCachedData =
        options && 'getCachedData' in options
            ? options.getCachedData // 明示的にundefinedが渡された場合もそのまま使用
            : (key: string) =>
                  nuxtApp.payload.data[key] || nuxtApp.static.data[key] // プロパティが省略された場合のデフォルト

    const { data, status, refresh } = useFetch<UserWithSetups>(
        `/api/user/${unref(id)}`,
        { key, dedupe, lazy, getCachedData: finalGetCachedData }
    )

    return { user: data, status, fetchUser: refresh }
}
