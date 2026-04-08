<script lang="ts" setup>
import { withLeadingSlash, joinURL } from 'ufo'

const { app } = useAppConfig()
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

const commitLogUrl = computed(() => {
    if (!data.value?.content?.commitLogPath) return null
    return joinURL(app.repo, 'commits/main', data.value.content.commitLogPath)
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

        <h1 class="text-highlighted text-5xl font-bold">
            {{ data.content.title }}
        </h1>

        <div class="flex items-center gap-2 empty:hidden">
            <UBadge
                v-if="data.content.updatedAt"
                :label="$t('content.updatedAt', { date: data.content.updatedAt })"
                variant="soft"
                color="neutral"
            />
            <UBadge
                v-if="data.content.effectiveDate"
                :label="$t('content.effectiveDate', { date: data.content.effectiveDate })"
                variant="soft"
                color="neutral"
            />
            <UButton
                v-if="commitLogUrl"
                :to="commitLogUrl"
                target="_blank"
                external
                :label="$t('content.changeLog')"
                trailing-icon="mingcute:arrow-right-up-line"
                variant="ghost"
                color="neutral"
                size="xs"
            />
        </div>

        <ContentRenderer
            :value="data.content"
            class="sentence mt-4 whitespace-pre-wrap *:first:mt-0 *:last:mb-0"
        />

        <template #right>
            <UContentToc :links="data.content?.body?.toc?.links" />
        </template>
    </UPage>
</template>
