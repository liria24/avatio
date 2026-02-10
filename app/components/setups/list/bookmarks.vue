<script setup lang="ts">
const setupsPerPage: number = BOOKMARKS_LIST_PER_PAGE
const page = ref(1)
const loading = ref(true)

const { bookmarks, status, refresh } = useBookmarks({
    query: computed(() => ({
        page: page.value,
        perPage: setupsPerPage,
    })),
    immediate: false,
})

const setups = ref<SerializedSetup[]>([])

const initialize = async () => {
    await refresh()
    setups.value = bookmarks.value?.data.map((bookmark) => bookmark.setup) || []
    loading.value = false
}

const loadMoreSetups = async () => {
    if (bookmarks.value?.pagination.hasNext) {
        page.value += 1
        await refresh()
        setups.value = [
            ...setups.value,
            ...(bookmarks.value?.data.map((bookmark) => bookmark.setup) || []),
        ]
    }
}

await initialize()
</script>

<template>
    <div class="flex w-full flex-col gap-3 self-center">
        <SetupsList v-model:setups="setups" v-model:loading="loading" />
        <UButton
            v-if="bookmarks?.pagination.hasNext"
            :loading="status === 'pending'"
            :label="$t('more')"
            variant="soft"
            size="lg"
            class="w-fit self-center"
            @click="loadMoreSetups()"
        />
    </div>
</template>
