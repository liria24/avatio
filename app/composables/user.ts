import type { UseFetchOptions } from 'nuxt/app'

export const useUser = (username: string, options?: UseFetchOptions<Serialized<User>>) => {
    const defaultOptions: UseFetchOptions<Serialized<User>> = {
        key: computed(() => `user-${unref(username)}`),
        dedupe: 'defer',
        lazy: false,
        immediate: true,
    }

    return useFetch<Serialized<User>>(`/api/users/${username}`, {
        ...defaultOptions,
        ...options,
    })
}

export const useCurrentUser = () => {
    const { session } = useAuth()
    return useUser(session.value?.user.username || '')
}
