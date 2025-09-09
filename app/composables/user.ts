import type { UseFetchOptions } from 'nuxt/app'

export const useUser = (id: string, options?: UseFetchOptions<User>) => {
    const defaultOptions: UseFetchOptions<User> = {
        key: computed(() => `user-${unref(id)}`),
        dedupe: 'defer',
        lazy: false,
        immediate: true,
    }

    return useFetch<User>(id, {
        ...defaultOptions,
        ...options,
        baseURL: '/api/users/',
    })
}
