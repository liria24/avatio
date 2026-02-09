<script setup lang="ts">
const { app } = useAppConfig()

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
    title: '変更履歴',
    description: 'Avatioの変更履歴を確認できます。',
    image: `${app.site}/ogp.png`,
})
</script>

<template>
    <div class="flex w-full flex-col gap-12 pt-8">
        <h1 class="text-5xl font-bold">変更履歴</h1>

        <ChangelogsView :versions />
    </div>
</template>
