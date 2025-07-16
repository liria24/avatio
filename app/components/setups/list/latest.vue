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
const initialLoad = ref(true)

const { data, status, refresh } = await useSetups({
    query: computed(() => ({
        page: page.value,
        perPage: setupsPerPage,
    })),
    getCachedData: props.cache
        ? (key: string) => nuxtApp.payload.data[key] || nuxtApp.static.data[key]
        : undefined,
})
initialLoad.value = false

const setups = ref<Setup[]>(data.value?.data || [])

const loadMoreSetups = async () => {
    if (data.value?.pagination.hasNext) {
        page.value += 1
        await refresh()
        setups.value = [...setups.value, ...(data.value?.data || [])]
    }
}
</script>

<template>
    <div class="flex w-full flex-col gap-3 self-center">
        <SetupsList v-model:setups="setups" v-model:loading="initialLoad" />
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
