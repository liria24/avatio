<script lang="ts" setup>
const shops = ref<
    {
        id: string;
        name: string;
        thumbnail: string;
        verified_at: string;
    }[]
>([]);
const getting = ref(false);
const modalAdd = ref(false);
const modalUnverify = ref(false);
const unverifyId = ref<string | null>(null);

const get = async () => {
    getting.value = true;

    const user = useSupabaseUser();
    const client = useSupabaseClient();

    const { data } = await client
        .from('user_shops')
        .select(
            `
        created_at,
        user_id,
        shop:shop_id(
            id,
            name,
            thumbnail
        )
        `
        )
        .eq('user_id', user.value?.id);

    shops.value =
        data?.map((shop) => ({
            id: shop.shop.id,
            name: shop.shop.name,
            thumbnail: shop.shop.thumbnail,
            verified_at: shop.created_at,
        })) ?? [];

    getting.value = false;
};

const unverify = async (id: string) => {
    try {
        await $fetch('/api/shop-verification/unverify', {
            method: 'POST',
            body: { shopId: id },
        });

        useToast().add('認証を解除しました');
    } catch {
        useToast().add('認証の解除に失敗しました');
    }

    get();
};

onMounted(() => {
    get();
});
</script>

<template>
    <UiCard
        :divider="false"
        class="pb-4"
        header-class="flex gap-4 items-center justify-between"
    >
        <template #header>
            <UiTitle label="オーナー認証" icon="lucide:store" is="h2" />
        </template>

        <div v-if="getting" class="w-full flex items-center justify-center">
            <Icon
                name="svg-spinners:ring-resize"
                size="24"
                class="text-zinc-600 dark:text-zinc-400"
            />
        </div>

        <div v-else class="w-full px-3 flex flex-col gap-2 items-center">
            <table
                v-if="shops?.length"
                class="table-auto w-full text-xs sm:text-sm"
            >
                <thead>
                    <tr>
                        <th class="px-1 pb-2 text-left">ショップ</th>
                        <th class="px-1 pb-2 text-left">ID</th>
                        <th class="px-1 pb-2 text-left">プラットフォーム</th>
                        <th class="px-1 pb-2 text-left">認証日時</th>
                        <th class="px-1 pb-2 text-left"></th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="item in shops" :key="item.id">
                        <td class="px-1 py-1">
                            <div
                                class="flex flex-col sm:flex-row items-start sm:items-center gap-x-3 gap-y-1"
                            >
                                <NuxtImg
                                    :src="item.thumbnail"
                                    :width="24"
                                    :height="24"
                                    format="webp"
                                    fit="cover"
                                    loading="lazy"
                                    class="rounded-md ring-1 ring-zinc-300 dark:ring-zinc-600"
                                />
                                <span class="text-zinc-600 dark:text-zinc-400">
                                    {{ item.name }}
                                </span>
                            </div>
                        </td>
                        <td
                            class="px-1 py-1 text-left text-zinc-600 dark:text-zinc-400"
                        >
                            {{ item.id }}
                        </td>
                        <td
                            class="px-1 py-1 text-left text-zinc-600 dark:text-zinc-400"
                        >
                            booth.pm
                        </td>
                        <td
                            class="px-1 py-1 text-left text-zinc-600 dark:text-zinc-400"
                        >
                            {{
                                new Date(item.verified_at).toLocaleDateString(
                                    'ja-JP',
                                    {
                                        year: 'numeric',
                                        month: '2-digit',
                                        day: '2-digit',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    }
                                )
                            }}
                        </td>
                        <td
                            class="py-1 text-left text-zinc-600 dark:text-zinc-400"
                        >
                            <Button
                                tooltip="認証解除"
                                variant="flat"
                                class="p-2"
                                @click="
                                    unverifyId = item.id;
                                    modalUnverify = true;
                                "
                            >
                                <Icon name="lucide:x" size="16" />
                            </Button>
                        </td>
                    </tr>
                </tbody>
            </table>

            <Button variant="flat" class="w-full" @click="modalAdd = true">
                <Icon name="lucide:plus" size="22" />
                <span>新しく認証</span>
            </Button>
        </div>

        <ModalShopVerify
            v-model="modalAdd"
            v-model:shops="shops"
            @refresh="get"
        />

        <Modal v-model="modalUnverify">
            <template #header>
                <DialogTitle>
                    <UiTitle label="認証解除" icon="lucide:unlink" />
                </DialogTitle>
            </template>

            <p class="py-3 px-2 text-zinc-700 dark:text-zinc-300 text-sm">
                ショップオーナー認証を解除しますか？
            </p>

            <template #footer>
                <div class="gap-1.5 flex items-center justify-between">
                    <Button
                        label="キャンセル"
                        variant="flat"
                        @click="modalUnverify = false"
                    />
                    <Button
                        label="認証を解除"
                        @click="
                            () => {
                                modalUnverify = false;
                                if (unverifyId) unverify(unverifyId);
                            }
                        "
                    />
                </div>
            </template>
        </Modal>
    </UiCard>
</template>
