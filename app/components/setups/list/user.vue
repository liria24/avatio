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

    const { data } = await $fetch<
        ApiResponse<{ setups: SetupClient[]; hasMore: boolean }>
    >('/api/setups/user', {
        method: 'GET',
        query: {
            userId: props.userId,
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

await get();
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
