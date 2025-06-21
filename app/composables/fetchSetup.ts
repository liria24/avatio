import type { MultiWatchSources } from 'vue'

export const useFetchSetup = (
    id: MaybeRef<number>,
    options?: {
        key?: MaybeRef<string>
        dedupe?: 'cancel' | 'defer'
        lazy?: boolean
        getCachedData?: (key: string) => Setup | undefined
        immediate?: boolean
        watch?: false | MultiWatchSources | undefined
    }
) => {
    const nuxtApp = useNuxtApp()
    const {
        key = computed(() => `setup-${unref(id)}`),
        dedupe = 'defer',
        lazy = true,
        immediate = true,
        watch = undefined,
    } = options || {}

    const finalGetCachedData =
        options && 'getCachedData' in options
            ? options.getCachedData
            : (key: string) =>
                  nuxtApp.payload.data[key] || nuxtApp.static.data[key]

    const { data, status, refresh } = useFetch<Setup>(
        `/api/setup/${unref(id)}`,
        {
            key,
            dedupe,
            lazy,
            getCachedData: finalGetCachedData,
            immediate,
            watch,
        }
    )

    return { setup: data, status, fetchSetup: refresh }
}
