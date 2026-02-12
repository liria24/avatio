<script setup lang="ts">
const { app } = useAppConfig()
const { t } = useI18n()

defineSeo({
    title: t('changelogs.title'),
    description: t('changelogs.description'),
    image: `${app.site}/ogp.png`,
})
</script>

<template>
    <div class="flex w-full flex-col gap-12 pt-8">
        <h1 class="text-5xl font-bold">{{ $t('changelogs.title') }}</h1>

        <ChangelogsView />
    </div>
</template>
