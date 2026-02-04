import type { UseFetchOptions } from 'nuxt/app'

interface TagResponse {
    tag: string
    count: number
}

export const useSetupTags = (options?: UseFetchOptions<TagResponse[]>) => {
    const defaultOptions: UseFetchOptions<TagResponse[]> = {
        dedupe: 'defer',
        lazy: false,
        immediate: true,
    }

    return useFetch<TagResponse[]>('/api/setups/tags', {
        ...defaultOptions,
        ...options,
    })
}
