<script lang="ts" setup>
import type { AvatioContentPage } from '@avatio/nuxt/runtime/content'
import { joinURL } from 'ufo'

const props = defineProps<{ slug: string }>()
const { app } = useAppConfig()
const { locale, localeProperties } = useI18n()

const { data, error } = await useAvatioContent(() => props.slug, locale)
if (error.value || !data.value)
    throw createError({ statusCode: 404, statusMessage: 'Page not found.' })

const page = computed(() => data.value as AvatioContentPage)
const frontmatter = computed(() => page.value.frontmatter)
const commitLogUrl = computed(() =>
    frontmatter.value.commitLogPath
        ? joinURL(app.repo, 'commits/main', frontmatter.value.commitLogPath)
        : null,
)

const ogImage = await useOgImage({
    title: frontmatter.value.title,
    description: frontmatter.value.description,
})

useSeo({
    title: frontmatter.value.title,
    description: frontmatter.value.description,
    image: ogImage,
    twitterCard: 'summary_large_image',
})
useHead(() => frontmatter.value.head ?? {})
useSeoMeta({
    ...frontmatter.value.seo,
    title: frontmatter.value.title,
    description: frontmatter.value.description,
})
useRobotsRule(computed(() => frontmatter.value.robots ?? true))

const schemaOrg = frontmatter.value.schemaOrg
if (schemaOrg) {
    const nodes = Array.isArray(schemaOrg) ? schemaOrg : [schemaOrg]
    useSchemaOrg(nodes as Parameters<typeof useSchemaOrg>[0])
}
</script>

<template>
    <UPage v-if="data" :ui="{ center: 'flex flex-col gap-6' }">
        <UAlert
            v-if="page.isFallback"
            :title="$t('content.fallbackNotice', { locale: localeProperties.name })"
            :description="$t('content.fallbackDescription')"
            variant="subtle"
        />

        <h1 class="text-highlighted text-5xl font-bold">
            {{ frontmatter.title }}
        </h1>

        <div class="flex items-center gap-2 empty:hidden">
            <UBadge
                v-if="frontmatter.updatedAt"
                :label="$t('content.updatedAt', { date: frontmatter.updatedAt })"
                variant="soft"
                color="neutral"
            />
            <UBadge
                v-if="frontmatter.effectiveDate"
                :label="$t('content.effectiveDate', { date: frontmatter.effectiveDate })"
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

        <MarkdownDocument
            :value="page.document"
            class="sentence mt-4 whitespace-pre-wrap *:first:mt-0 *:last:mb-0"
        />

        <template #right>
            <UContentToc :links="page.toc" />
        </template>
    </UPage>
</template>
