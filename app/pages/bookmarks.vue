<script lang="ts" setup>
const setupsPerPage: number = 50
const page = ref(1)

const { data, status, refresh } = await useBookmarks({
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
    if (data.value)
        setups.value.push(...data.value.data.map((bookmark) => bookmark.setup))
})

defineSeo({
    title: 'ブックマーク',
    description: 'あなたがブックマークしたセットアップを確認できます。',
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
                v-if="data?.pagination.hasNext"
                :loading="status === 'pending'"
                label="もっと見る"
                @click="loadMoreSetups()"
            />
        </div>
    </div>
</template>
