<script setup lang="ts">
const { t, locale } = useI18n()
const { data: changelogs } = useFetch('/api/changelogs', {
    key: computed(() => `changelogs-${locale.value}`),
    query: { lang: locale.value },
    dedupe: 'defer',
    watch: [locale],
})

useSeo({
    title: t('changelogs.title'),
    description: t('changelogs.description'),
    image: {
        component: 'General.takumi',
        props: {
            title: t('changelogs.title'),
            description: t('changelogs.description'),
        },
    },
    twitterCard: 'summary_large_image',
})
</script>

<template>
    <div class="flex w-full flex-col gap-12 pt-8">
        <h1 class="text-5xl font-bold">{{ $t('changelogs.title') }}</h1>

        <UChangelogVersions>
            <IslandChangelog
                v-for="(changelog, index) in changelogs?.data"
                :key="index"
                :slug="changelog.slug"
            />
        </UChangelogVersions>
    </div>
</template>
