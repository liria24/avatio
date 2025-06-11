<script lang="ts" setup>
defineSeo({
    title: 'ブックマーク',
})
</script>

<template>
    <div class="flex flex-col gap-5">
        <UiTitle label="ブックマーク" icon="lucide:bookmark" size="lg" />

        <SetupsListBookmarks />
    </div>
</template>
