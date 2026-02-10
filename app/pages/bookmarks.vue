<script lang="ts" setup>
definePageMeta({
    middleware: 'session',
})

const { t } = useI18n()

defineSeo({
    title: t('bookmarks.title'),
    description: t('bookmarks.description'),
})
</script>

<template>
    <div class="flex flex-col gap-5">
        <div class="flex items-center gap-2">
            <Icon name="mingcute:bookmark-fill" size="22" class="text-muted" />
            <h1 class="text-xl leading-none font-semibold text-nowrap">
                {{ $t('bookmarks.title') }}
            </h1>
        </div>

        <SetupsList type="bookmarked" />
    </div>
</template>
