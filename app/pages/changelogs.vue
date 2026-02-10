<script setup lang="ts">
const { app } = useAppConfig()
const { t } = useI18n()

const { data: versions } = await useFetch('/api/changelogs', {
    dedupe: 'defer',
    getCachedData: (key, nuxtApp, ctx) =>
        ctx.cause === 'refresh:manual'
            ? undefined
            : nuxtApp.payload.data[key] || nuxtApp.static.data[key],
    transform: (response) =>
        response.data.map((item) => ({
            title: item.title,
            description: '',
            date: item.createdAt,
            content: item.markdown,
        })),
    default: () => [],
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

        <ChangelogsView :versions />
    </div>
</template>
