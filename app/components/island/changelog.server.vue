<script setup lang="ts">
interface Props {
    slug: string
}
const { slug } = defineProps<Props>()

const { locale, localeProperties } = useI18n()
const { data: changelog } = await useFetch(`/api/changelogs/${slug}`, {
    query: { lang: locale.value },
})
</script>

<template>
    <UChangelogVersion
        v-if="changelog"
        :title="changelog.title"
        :date="changelog.createdAt"
        :ui="{
            container: 'lg:ml-40 mr-0 max-w-full',
            title: 'sentence text-3xl font-bold before:text-muted before:font-[Geist] before:tracking-tight before:font-light before:content-[\'//_\']',
            description: 'flex flex-col items-start gap-5 mt-5',
        }"
    >
        <template #description>
            <USeparator />
            <UBadge
                v-if="changelog.fallbacked"
                :label="$t('changelogs.fallbacked', { locale: localeProperties.name })"
                variant="soft"
            />
            <MDC
                v-if="changelog.markdown"
                :value="changelog.markdown"
                :parser-options="{
                    toc: false,
                    contentHeading: false,
                }"
                class="sentence w-full max-w-full *:first:mt-0 *:last:mb-0 [&_img]:max-w-lg"
            />
            <UBadge
                v-if="changelog.aiGenerated"
                icon="mingcute:translate-2-ai-line"
                :label="$t('changelogs.translatedByAi')"
                variant="soft"
            />
        </template>
    </UChangelogVersion>
</template>
