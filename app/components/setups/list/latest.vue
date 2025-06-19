<script setup lang="ts">
const setupsPerPage: number = 50
const page = ref(1)

const {
    setups: fetchedSetups,
    hasMore,
    status,
    fetchSetups,
} = await useFetchSetups({
    query: computed(() => ({
        page: page.value,
        perPage: setupsPerPage,
    })),
})

const setups = ref<Setup[]>([])

const loadMoreSetups = () => {
    if (hasMore.value) {
        page.value += 1
        fetchSetups()
    }
}

watchEffect(() => {
    setups.value.push(...fetchedSetups.value)
})
</script>

<template>
    <div class="flex w-full flex-col gap-3 self-center">
        <SetupsList v-model:setups="setups" v-model:status="status" />
        <UButton
            v-if="hasMore"
            :loading="status === 'pending'"
            label="もっと見る"
            @click="loadMoreSetups()"
        />
    </div>
</template>
