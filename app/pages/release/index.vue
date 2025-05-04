<script setup lang="ts">
const releases = ref<DocumentData[]>([]);
try {
    releases.value = await $fetch('/api/releases');
} catch (e) {
    console.error(e);
}

useOGP({
    title: 'お知らせ',
    description: 'Avatioからのお知らせをお届けします。',
});
</script>

<template>
    <div class="w-full flex flex-col gap-6 items-center">
        <div class="w-full pt-12 pb-24 flex items-center gap-4">
            <Icon name="lucide:rss" size="48" />
            <h1 class="text-4xl font-bold leading-none">お知らせ</h1>
        </div>

        <div v-if="releases?.length" class="w-full flex flex-col">
            <UiRelease
                v-for="(i, index) in releases"
                :key="'release-' + i.slug"
                :data="i"
                :index="index"
            />
        </div>

        <template v-else>
            <p
                class="mt-4 text-center text-sm text-zinc-500 dark:text-zinc-400"
            >
                お知らせがありません
            </p>
        </template>
    </div>
</template>
