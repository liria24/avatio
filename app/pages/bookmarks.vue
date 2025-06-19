<script lang="ts" setup>
const setupsPerPage: number = 50
const page = ref(1)

const {
    bookmarks: fetchedBookmarks,
    hasMore,
    status,
    fetchBookmarks,
} = await useFetchBookmarks({
    query: computed(() => ({
        page: page.value,
        perPage: setupsPerPage,
    })),
})

const setups = ref<Setup[]>([])

const loadMoreSetups = () => {
    if (hasMore.value) {
        page.value += 1
        fetchBookmarks()
    }
}

watchEffect(() => {
    setups.value.push(
        ...fetchedBookmarks.value.map((bookmark) => bookmark.setup)
    )
})

defineSeo({
    title: 'ブックマーク',
})
</script>

<template>
    <div class="flex flex-col gap-5">
        <div class="flex items-center gap-2">
            <Icon name="lucide:bookmark" size="22" class="text-muted" />
            <h1 class="text-xl leading-none font-semibold text-nowrap">
                ブックマーク
            </h1>
        </div>

        <div class="flex w-full flex-col gap-3 self-center">
            <SetupsList v-model:setups="setups" v-model:status="status" />
            <UButton
                v-if="hasMore"
                :loading="status === 'pending'"
                label="もっと見る"
                @click="loadMoreSetups()"
            />
        </div>
    </div>
</template>
