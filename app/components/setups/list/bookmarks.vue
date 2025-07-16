<script setup lang="ts">
const nuxtApp = useNuxtApp()

interface Props {
    cache?: boolean
}
const props = withDefaults(defineProps<Props>(), {
    cache: true,
})

const setupsPerPage: number = 50
const page = ref(1)

const { data, status, refresh } = await useBookmarks({
    query: computed(() => ({
        page: page.value,
        perPage: setupsPerPage,
    })),
    getCachedData: props.cache
        ? (key: string) => nuxtApp.payload.data[key] || nuxtApp.static.data[key]
        : undefined,
})

const setups = ref<Setup[]>(
    data.value?.data.map((bookmark) => bookmark.setup) || []
)

const loadMoreSetups = async () => {
    if (data.value?.pagination.hasNext) {
        page.value += 1
        await refresh()
        setups.value = [
            ...setups.value,
            ...(data.value?.data.map((bookmark) => bookmark.setup) || []),
        ]
    }
}
</script>

<template>
    <div class="flex w-full flex-col gap-3 self-center">
        <SetupsList v-model:setups="setups" v-model:status="status" />
        <UButton
            v-if="data?.pagination.hasNext"
            :loading="status === 'pending'"
            label="もっと見る"
            variant="soft"
            size="lg"
            class="w-fit self-center"
            @click="loadMoreSetups()"
        />
    </div>
</template>
