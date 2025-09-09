import type { UseFetchOptions } from 'nuxt/app'

export const useSetup = (id: number, options?: UseFetchOptions<Setup>) => {
    const defaultOptions: UseFetchOptions<Setup> = {
        key: computed(
            () => `setup-${id}-${JSON.stringify(unref(options?.query))}`
        ),
        dedupe: 'defer',
        lazy: false,
        immediate: true,
    }

    return useFetch<Setup>(id.toString(), {
        ...defaultOptions,
        ...options,
        baseURL: '/api/setups/',
    })
}
