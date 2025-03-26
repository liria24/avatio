<script lang="ts" setup>
const setups = ref<SetupClient[]>([]);
const setupsPerPage: number = 50;
const page = ref(0);
const hasMore = ref(false);
const loading = ref(true);

const get = async () => {
    loading.value = true;

    const { data } = await $fetch<
        ApiResponse<{ setups: SetupClient[]; hasMore: boolean }>
    >('/api/setups/bookmarks', {
        method: 'GET',
        query: {
            page: page.value,
            perPage: setupsPerPage,
        },
    });
    if (!data) return (loading.value = false);

    setups.value = [...setups.value, ...data.setups];
    page.value++;
    hasMore.value = data.hasMore;

    loading.value = false;
};

onMounted(async () => {
    await get();
});
</script>

<template>
    <div class="self-center w-full flex flex-col gap-3">
        <SetupsListBase :setups="setups" />
        <ButtonLoadMore
            v-if="hasMore"
            :loading="loading"
            class="w-full"
            @click="get"
        />
    </div>
</template>
