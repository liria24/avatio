export const useUser = (username: MaybeRefOrGetter<User['username']>) => {
    const path = computed(() => `/api/users/${toValue(username)}` as '/api/users/:username')

    return useFetch(path, {
        key: computed(() => `user-${toValue(username)}`),
        dedupe: 'defer',
    })
}
