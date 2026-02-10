<script setup lang="ts">
interface Props {
    username: string
}
const props = defineProps<Props>()

const setupsPerPage: number = 50
const page = ref(1)
const loading = ref(true)

const { data, status, refresh } = useSetups({
    query: computed(() => ({
        page: page.value,
        perPage: setupsPerPage,
        username: props.username,
    })),
    immediate: false,
})

const setups = ref<SerializedSetup[]>([])

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
            :label="$t('more')"
            variant="soft"
            size="lg"
            class="w-fit self-center"
            @click="loadMoreSetups()"
        />
    </div>
</template>
