import type { UseFetchOptions } from 'nuxt/app'

export const useUser = (username: string, options?: UseFetchOptions<SerializedUser>) => {
    const defaultOptions: UseFetchOptions<SerializedUser> = {
        key: computed(() => `user-${unref(username)}`),
        dedupe: 'defer',
        lazy: false,
        immediate: true,
    }

    return useFetch<SerializedUser>(`/api/users/${username}`, {
        ...defaultOptions,
        ...options,
    })
}
