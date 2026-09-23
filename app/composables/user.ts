import type { FetchResult } from 'nuxt/app'

type UserResponse = FetchResult<'/api/users/:username', 'get'>

export const useUser = (username: MaybeRefOrGetter<User['username']>) => {
    const path = computed(() => `/api/users/${toValue(username)}` as '/api/users/:username')

    return useFetch<UserResponse>(path, {
        key: computed(() => `user-${toValue(username)}`),
        dedupe: 'defer',
    })
}
