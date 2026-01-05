import type { UseFetchOptions } from 'nuxt/app'

export const useSetup = (id: number, options?: UseFetchOptions<SerializedSetup>) => {
    const defaultOptions: UseFetchOptions<SerializedSetup> = {
        key: computed(() => `setup-${id}-${JSON.stringify(unref(options?.query))}`),
        dedupe: 'defer',
        lazy: false,
        immediate: true,
    }

    return useFetch<SerializedSetup>(id.toString(), {
        ...defaultOptions,
        ...options,
        baseURL: '/api/setups/',
    })
}
