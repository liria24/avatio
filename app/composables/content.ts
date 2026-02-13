import type { Collections } from '@nuxt/content'

import { withLeadingSlash, withoutLeadingSlash } from 'ufo'

export const useContentPage = (path: MaybeRefOrGetter<string>) => {
    const { locale } = useI18n()

    const _path = computed(() => toValue(path))

    const key = computed(() => `page-${locale.value}-${withoutLeadingSlash(_path.value)}`)

    const asyncData = useAsyncData(
        key,
        async () => {
            const collection = ('content_' + locale.value) as keyof Collections
            const content = await queryCollection(collection)
                .path(withLeadingSlash(_path.value))
                .first()

            if (!content && locale.value !== 'ja') {
                const fallbackContent = await queryCollection('content_ja')
                    .path(withLeadingSlash(_path.value))
                    .first()
                return { content: fallbackContent, isFallback: true }
            }

            return { content, isFallback: false }
        },
        {
            watch: [locale, _path],
        },
    )

    return asyncData
}
