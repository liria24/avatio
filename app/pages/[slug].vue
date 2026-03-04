<script lang="ts" setup>
import { withLeadingSlash } from 'ufo'

const route = useRoute()
const { localeProperties } = useI18n()

const slug = computed(() =>
    Array.isArray(route.params.slug)
        ? withLeadingSlash(String(route.params.slug.join('/')))
        : withLeadingSlash(String(route.params.slug)),
)

const { data } = await useContentPage(slug.value)

if (!data.value)
    showError({
        status: 404,
        statusText: 'Page not found.',
    })

useSeo({
    title: data.value?.content?.title,
    description: data.value?.content?.description,
    image: {
        component: 'General.takumi',
        props: {
            title: data.value?.content?.title,
            description: data.value?.content?.description,
        },
    },
    twitterCard: 'summary_large_image',
})
// @ts-expect-error - `useHead` is not typed to accept the content of `data.value?.content?.head`, but it should work as expected.
useHead(data.value?.content?.head || {})
useSeoMeta(data.value?.content?.seo || {})
</script>

<template>
    <UPage v-if="data && data.content" :ui="{ center: 'flex flex-col gap-6' }">
        <UAlert
            v-if="data.isFallback"
            :title="$t('content.fallbackNotice', { locale: localeProperties.name })"
            :description="$t('content.fallbackDescription')"
            variant="subtle"
        />

        <ContentRenderer :value="data.content" class="sentence" />

        <template #right>
            <UContentToc :links="data.content?.body?.toc?.links" />
        </template>
    </UPage>
</template>
