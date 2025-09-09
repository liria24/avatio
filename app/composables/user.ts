import type { UseFetchOptions } from 'nuxt/app'

export const useUser = (
    id: string,
    options?: UseFetchOptions<SerializedUser>
) => {
    const defaultOptions: UseFetchOptions<SerializedUser> = {
        key: computed(() => `user-${unref(id)}`),
        dedupe: 'defer',
        lazy: false,
        immediate: true,
    }

    return useFetch<SerializedUser>(id, {
        ...defaultOptions,
        ...options,
        baseURL: '/api/users/',
    })
}
