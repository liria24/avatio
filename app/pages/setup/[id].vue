<script setup lang="ts">
const user = useSupabaseUser();
const route = useRoute();

const id = Number(route.params.id);
const bookmark = ref(false);

const modalLogin = ref(false);
const modalReport = ref(false);

if (!id)
    showError({
        statusCode: 404,
        message: 'IDが無効です',
    });

const { data, error } = await $fetch<ApiResponse<SetupClient>>(`/api/setup`, {
    method: 'GET',
    query: { id },
});

if (error && error.status === 404)
    showError({
        statusCode: 404,
        message: 'セットアップが見つかりませんでした',
    });

if (error)
    showError({
        statusCode: 500,
        message: 'セットアップの取得に失敗しました',
    });

useOGP({
    title: `${data!.name} @${data!.author.name}`,
    description: data!.description,
    image: data!.images.length
        ? useGetImage(data!.images[0]!.name, { prefix: 'setup' })
        : 'https://avatio.me/ogp.png',
    twitterCard: data!.images.length ? 'summary_large_image' : 'summary',
});

onMounted(async () => {
    bookmark.value = await useCheckBookmark(id);
});
</script>

<template>
    <div v-if="data" class="flex flex-col gap-8">
        <SetupsViewer
            :id="id"
            :created-at="data.created_at"
            :title="data.name"
            :description="data.description"
            :images="data.images"
            :tags="data.tags"
            :co-authors="data.co_authors"
            :unity="data.unity"
            :author="data.author"
            :items="data.items"
            @login="modalLogin = true"
        />

        <Button
            label="セットアップを報告"
            icon="lucide:flag"
            :icon-size="16"
            variant="flat"
            class="w-fit px-3 py-2 mt-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:bg-zinc-300 hover:dark:bg-zinc-700"
            icon-class="text-red-400 dark:text-red-400"
            @click="
                if (user) modalReport = true;
                else modalLogin = true;
            "
        />

        <Modal v-model="modalLogin">
            <UiLogin
                :redirect="`/setup/${route.params.id}`"
                @login-success="
                    modalLogin = false;
                    (async () => {
                        if (!data) return;
                        bookmark = await useCheckBookmark(id);
                    })();
                "
            />
        </Modal>

        <ModalReportSetup v-model="modalReport" :id="Number(id)" />
    </div>
</template>
