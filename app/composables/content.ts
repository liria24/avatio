import type { Collections } from '@nuxt/content'

import { withLeadingSlash, withoutLeadingSlash } from 'ufo'

export const useContentPage = async (path: string) => {
    const { locale } = useI18n()

    const { data, refresh, status } = await useAsyncData(
        `page-${withoutLeadingSlash(path)}`,
        async () => {
            const collection = ('content_' + locale.value) as keyof Collections
            const content = await queryCollection(collection).path(withLeadingSlash(path)).first()

            if (!content && locale.value !== 'ja') {
                const fallbackContent = await queryCollection('content_ja')
                    .path(withLeadingSlash(path))
                    .first()
                return { content: fallbackContent, isFallback: true }
            }

            return { content, isFallback: false }
        },
        {
            watch: [locale],
        }
    )

    const page = computed(() => data.value?.content)
    const isFallback = computed(() => data.value?.isFallback ?? false)

    return { page, refresh, status, isFallback }
}
