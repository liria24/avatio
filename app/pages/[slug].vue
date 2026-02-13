<script lang="ts" setup>
import { withLeadingSlash } from 'ufo'

const { app } = useAppConfig()
const route = useRoute()
const { localeProperties } = useI18n()

const slug = computed(() =>
    Array.isArray(route.params.slug)
        ? withLeadingSlash(String(route.params.slug.join('/')))
        : withLeadingSlash(String(route.params.slug)),
)

const { data, refresh } = await useContentPage(slug.value)

watch(slug, async () => {
    await refresh()
})

if (!data.value)
    showError({
        status: 404,
        statusText: 'Page not found.',
    })

defineSeo({
    title: data.value?.content?.title,
    description: data.value?.content?.description,
    image: `${app.site}${withLeadingSlash(data.value?.content?.image)}`,
})
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
