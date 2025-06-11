<script lang="ts" setup>
// const setups = ref<SetupClient[]>([])
const setupsPerPage: number = 50
const page = ref(0)
const hasMore = ref(false)
const loading = ref(true)

const { setups } = useFetchSetups('latest', {
    query: { page: page.value, perPage: setupsPerPage },
})
console.log('setups', setups.value)

const get = async () => {
    loading.value = true

    try {
        const response = await $fetch('/api/setup/latest', {
            query: {
                page: page.value,
                perPage: setupsPerPage,
            },
        })

        page.value++
        hasMore.value = response.hasMore
    } catch (e) {
        console.error('セットアップの取得に失敗しました:', e)
    } finally {
        loading.value = false
    }
}

try {
    await get()
} catch (e) {
    console.error('初期ロード失敗:', e)
}
</script>

<template>
    <div class="flex w-full flex-col gap-3 self-center">
        <SetupsListBase :setups="setups" :loading="loading" />
        <ButtonLoadMore
            v-if="hasMore"
            :loading="loading"
            class="w-full"
            @click="get"
        />
    </div>
</template>
