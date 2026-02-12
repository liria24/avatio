import type { Collections } from '@nuxt/content'

import { withLeadingSlash, withoutLeadingSlash } from 'ufo'

export const useContentPage = async (path: MaybeRefOrGetter<string>) => {
    const { locale } = useI18n()
    const pathRef = toRef(path)

    const { data, refresh, status } = await useAsyncData(
        () => `page-${locale.value}-${withoutLeadingSlash(pathRef.value)}`,
        async () => {
            const collection = ('content_' + locale.value) as keyof Collections
            const content = await queryCollection(collection)
                .path(withLeadingSlash(pathRef.value))
                .first()

            if (!content && locale.value !== 'ja') {
                const fallbackContent = await queryCollection('content_ja')
                    .path(withLeadingSlash(pathRef.value))
                    .first()
                return { content: fallbackContent, isFallback: true }
            }

            return { content, isFallback: false }
        },
        {
            watch: [locale, pathRef],
        },
    )

    const page = computed(() => data.value?.content)
    const isFallback = computed(() => data.value?.isFallback ?? false)

    return { page, refresh, status, isFallback }
}
