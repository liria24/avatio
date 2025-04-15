<script lang="ts" setup>
interface Props {
    userId: string | null;
}
const props = defineProps<Props>();

const setups = ref<SetupClient[]>([]);
const setupsPerPage: number = 50;
const page = ref(0);
const hasMore = ref(false);
const loading = ref(true);

const get = async () => {
    loading.value = true;

    if (!props.userId) return (loading.value = false);

    try {
        const response = await $fetch('/api/setups/user', {
            method: 'GET',
            query: {
                userId: props.userId,
                page: page.value,
                perPage: setupsPerPage,
            },
        });

        if (!response) return (loading.value = false);

        setups.value = [...setups.value, ...response.setups];
        page.value++;
        hasMore.value = response.hasMore;
    } catch (e) {
        console.error('ユーザーセットアップの取得に失敗しました:', e);
    } finally {
        loading.value = false;
    }
};
// 初期ロード
try {
    await get();
} catch (e) {
    console.error('初期ロード失敗:', e);
    loading.value = false;
}
</script>

<template>
    <div class="self-center w-full flex flex-col gap-3">
        <SetupsListBase :setups="setups" :loading="loading" />
        <ButtonLoadMore
            v-if="hasMore"
            :loading="loading"
            class="w-full"
            @click="get"
        />
    </div>
</template>
