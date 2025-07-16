<script setup lang="ts">
const nuxtApp = useNuxtApp()

interface Props {
    userId: string
    cache?: boolean
}
const props = withDefaults(defineProps<Props>(), {
    cache: true,
})

const setupsPerPage: number = 50
const page = ref(1)
const loading = ref(true)

const { data, status, refresh } = useSetups({
    query: computed(() => ({
        page: page.value,
        perPage: setupsPerPage,
        userId: props.userId,
    })),
    getCachedData: props.cache
        ? (key: string) => nuxtApp.payload.data[key] || nuxtApp.static.data[key]
        : undefined,
    immediate: false,
})

const setups = ref<Setup[]>([])

const initialize = async () => {
    await refresh()
    setups.value = data.value?.data || []
    loading.value = false
}

const loadMoreSetups = async () => {
    if (data.value?.pagination.hasNext) {
        page.value += 1
        await refresh()
        setups.value = [...setups.value, ...(data.value?.data || [])]
    }
}

await initialize()
</script>

<template>
    <div class="flex w-full flex-col gap-3 self-center">
        <SetupsList v-model:setups="setups" v-model:loading="loading" />
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
