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

const { page, isFallback, refresh } = await useContentPage(slug.value)

watch(slug, async () => {
    await refresh()
})

if (!page.value)
    showError({
        status: 404,
        statusText: 'Page not found.',
    })

defineSeo({
    title: page.value?.title,
    description: page.value?.description,
    image: `${app.site}${withLeadingSlash(page.value?.image)}`,
})
</script>

<template>
    <UPage v-if="page" :ui="{ center: 'flex flex-col gap-6' }">
        <UAlert
            v-if="isFallback"
            :title="$t('content.fallbackNotice', { locale: localeProperties.name })"
            :description="$t('content.fallbackDescription')"
            variant="subtle"
        />

        <ContentRenderer :value="page" class="sentence" />

        <template #right>
            <UContentToc :links="page.body?.toc?.links" />
        </template>
    </UPage>
</template>
