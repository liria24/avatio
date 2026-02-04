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

export const useSetups = (options?: UseFetchOptions<PaginationResponse<SerializedSetup[]>>) => {
    const defaultOptions = {
        key: computed(() => `setups-${JSON.stringify(unref(options?.query))}`),
        default: () => ({
            data: [],
            pagination: {
                page: 1,
                limit: 0,
                total: 0,
                totalPages: 0,
                hasPrev: false,
                hasNext: false,
            },
        }),
        dedupe: 'defer',
        lazy: false,
        immediate: true,
    }

    return useFetch<PaginationResponse<SerializedSetup[]>>('/api/setups', {
        ...(defaultOptions as unknown as UseFetchOptions<PaginationResponse<SerializedSetup[]>>),
        ...options,
    })
}
