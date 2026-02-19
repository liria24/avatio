import type { UseFetchOptions, FetchResult } from 'nuxt/app'
import type { z } from 'zod'

import type { KeysOf } from '#app/composables/asyncData'

type UserSettingsRes = FetchResult<'/api/users/settings', 'get'>

export const useUserSettings = () => {
    const get = <
        DataT = UserSettingsRes,
        PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
        DefaultT = undefined,
    >(
        options?: UseFetchOptions<
            UserSettingsRes,
            DataT,
            PickKeys,
            DefaultT,
            '/api/users/settings',
            'get'
        >,
    ) =>
        useFetch('/api/users/settings', {
            key: 'user-settings',
            dedupe: 'defer',
            lazy: false,
            immediate: true,
            ...options,
        })

    const put = (
        body: z.infer<typeof userSettingsUpdateSchema>,
        options?: Omit<Parameters<typeof $fetch<unknown, '/api/users/settings'>>[1], 'body'>,
    ) =>
        $fetch('/api/users/settings', {
            method: 'PUT',
            ...options,
            body,
        })

    return {
        get,
        put,
    }
}
