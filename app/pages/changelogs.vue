<script setup lang="ts">
const { app } = useAppConfig()
const { t, locale, localeProperties } = useI18n()
const { data: changelogs } = useFetch('/api/changelogs', {
    query: { lang: locale.value },
    dedupe: 'defer',
    watch: [locale],
})

defineSeo({
    title: t('changelogs.title'),
    description: t('changelogs.description'),
    image: `${app.site}/ogp.png`,
})
</script>

<template>
    <div class="flex w-full flex-col gap-12 pt-8">
        <h1 class="text-5xl font-bold">{{ $t('changelogs.title') }}</h1>

        <UChangelogVersions>
            <UChangelogVersion
                v-for="(changelog, index) in changelogs?.data"
                :key="index"
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
                    <ServerMarkdown :content="changelog.markdown" />
                    <UBadge
                        v-if="changelog.aiGenerated"
                        icon="mingcute:translate-2-ai-line"
                        :label="$t('changelogs.translatedByAi')"
                        variant="soft"
                    />
                </template>
            </UChangelogVersion>
        </UChangelogVersions>
    </div>
</template>
