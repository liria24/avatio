import type { UseFetchOptions, FetchResult } from 'nuxt/app'

import type { KeysOf } from '#app/composables/asyncData'

type UserRes = FetchResult<'/api/users/:username', 'get'>

export const useUser = <
    DataT = UserRes,
    PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
    DefaultT = undefined,
>(
    username: string,
    options?: UseFetchOptions<UserRes, DataT, PickKeys, DefaultT, '/api/users/:username', 'get'>,
) =>
    useFetch(`/api/users/${username}`, {
        key: computed(() => `user-${unref(username)}`),
        dedupe: 'defer',
        lazy: false,
        immediate: true,
        ...options,
    })

export const useCurrentUser = () => {
    const { session } = useAuth()
    return useUser(session.value?.user.username || '')
}
