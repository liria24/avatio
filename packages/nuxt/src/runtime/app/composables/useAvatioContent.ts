import { useAsyncData, useRequestFetch } from 'nuxt/app'
import type { MaybeRefOrGetter } from 'vue'
import { computed, toValue } from 'vue'

import type { AvatioContentPage } from '../../content'

export const useAvatioContent = (
    slug: MaybeRefOrGetter<string>,
    locale: MaybeRefOrGetter<string>,
) => {
    const normalizedSlug = computed(() => toValue(slug).replace(/^\/+|\/+$/g, ''))
    const requestFetch = useRequestFetch()
    const key = computed(() => `avatio-content:${toValue(locale)}:${normalizedSlug.value}`)

    return useAsyncData(key, () =>
        requestFetch<AvatioContentPage>(`/api/avatio/content/${normalizedSlug.value}`, {
            query: { locale: toValue(locale) },
        }),
    )
}
