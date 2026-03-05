import type { UseFetchOptions, FetchResult } from 'nuxt/app'

import type { KeysOf } from '#app/composables/asyncData'

type SetupTagsRes = FetchResult<'/api/setups/tags', 'get'>

export const useSetupTags = <
    DataT = SetupTagsRes,
    PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
    DefaultT = undefined,
>(
    options?: UseFetchOptions<SetupTagsRes, DataT, PickKeys, DefaultT, '/api/setups/tags', 'get'>,
) =>
    useFetch('/api/setups/tags', {
        dedupe: 'defer',
        lazy: false,
        immediate: true,
        ...options,
    })
