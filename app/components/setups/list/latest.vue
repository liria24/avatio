<script setup lang="ts">
const setupsPerPage: number = 50
const page = ref(1)

const { data, status, refresh } = await useSetups({
    query: computed(() => ({
        page: page.value,
        perPage: setupsPerPage,
    })),
})

const setups = ref<Setup[]>([])

const loadMoreSetups = () => {
    if (data.value?.pagination.hasNext) {
        page.value += 1
        refresh()
    }
}

watchEffect(() => {
    if (data.value) setups.value.push(...data.value.data)
})
</script>

<template>
    <div class="flex w-full flex-col gap-3 self-center">
        <SetupsList v-model:setups="setups" v-model:status="status" />
        <UButton
            v-if="data?.pagination.hasNext"
            :loading="status === 'pending'"
            label="もっと見る"
            @click="loadMoreSetups()"
        />
    </div>
</template>
