<script lang="ts" setup>
const setupsPerPage: number = 50
const page = ref(0)

const { setups, hasMore, status, fetchMoreSetups } = useFetchSetups(
    'bookmarks',
    {
        query: computed(() => ({
            page: page.value,
            perPage: setupsPerPage,
        })),
    }
)

defineSeo({
    title: 'ブックマーク',
})
</script>

<template>
    <div class="flex flex-col gap-5">
        <UiTitle label="ブックマーク" icon="lucide:bookmark" size="lg" />

        <div class="flex w-full flex-col gap-3 self-center">
            <SetupsList :setups="setups" :loading="status === 'pending'" />
            <ButtonLoadMore
                v-if="hasMore"
                :loading="status === 'pending'"
                class="w-full"
                @click="fetchMoreSetups"
            />
        </div>
    </div>
</template>
