<script setup lang="ts">
const skipRouterHook = ref(false);

const publishing = ref(false);
const publishedSetupId = ref<number | null>(null);
const modalConfirm = ref(false);
const modalComplete = ref(false);
const modalPreview = ref(false);

const items = ref<Record<ItemCategory, SetupItem[]>>({
    avatar: [],
    cloth: [],
    accessory: [],
    hair: [],
    texture: [],
    shader: [],
    tool: [],
    other: [],
});
const { undo, redo } = useRefHistory(items, { deep: true });

const title = ref<string>('');
const description = ref<string>('');
const tags = ref<string[]>([]);
const coAuthors = ref<CoAuthor[]>([]);
const unity = ref<string>('');
const image = ref<Blob | null>(null);

const PublishSetup = async () => {
    publishing.value = true;

    try {
        const data = {
            name: title.value,
            description: description.value,
            unity: unity.value.length ? unity.value : null,
            tags: tags.value,
            coAuthors: coAuthors.value.map((i) => ({
                id: i.id,
                note: i.note,
            })),
            items: Object.values(items.value)
                .flat()
                .map((i) => ({
                    id: i.id,
                    category: i.category,
                    shapekeys: i.shapekeys,
                    note: i.note,
                    unsupported: i.unsupported,
                })),
            images: image.value ? [await blobToBase64(image.value)] : null,
            og_image: {
                positionX: 50,
                positionY: 50,
                width: 100,
            },
        };

        if (await setupErrorCheck(data)) return (publishing.value = false);

        const response = await $fetch('/api/setup', {
            method: 'PUT',
            body: data,
        });

        publishedSetupId.value = response.id;
        skipRouterHook.value = true;
        modalComplete.value = true;
    } catch (error) {
        console.error('投稿エラー:', error);
        return useToast().add('投稿に失敗しました');
    } finally {
        publishing.value = false;
    }
};

const reset = () => {
    title.value = '';
    description.value = '';
    tags.value = [];
    coAuthors.value = [];
    items.value = {
        avatar: [],
        cloth: [],
        accessory: [],
        hair: [],
        texture: [],
        shader: [],
        tool: [],
        other: [],
    };
    image.value = null;
    publishedSetupId.value = null;
    publishing.value = false;
    skipRouterHook.value = false;
};

onBeforeRouteLeave((to, from, next) => {
    if (skipRouterHook.value) return next(true);

    const hasChanges =
        title.value ||
        description.value.length ||
        tags.value.length ||
        coAuthors.value.length ||
        unity.value.length ||
        image.value !== null;

    if (hasChanges) {
        const answer = window.confirm(
            '入力された内容が破棄されます。よろしいですか？'
        );
        return next(answer);
    }
    return next(true);
});

useOGP({ title: 'セットアップ作成' });
</script>

<template>
    <div class="relative size-full pb-5 lg:pl-[23rem]">
        <SetupsEditSidebar
            v-model:publishing="publishing"
            v-model:title="title"
            v-model:description="description"
            v-model:tags="tags"
            v-model:co-authors="coAuthors"
            v-model:unity="unity"
            v-model:image="image"
            class="static lg:absolute top-0 bottom-4 left-0 lg:w-[22rem] overflow-y-auto"
            @preview="modalPreview = true"
            @publish="modalConfirm = true"
        />

        <UiDivider class="static lg:hidden my-8" />

        <SetupsEditItems
            v-model="items"
            class="w-full h-full"
            @undo="undo"
            @redo="redo"
        />

        <ModalPublishSetupComplete
            v-model="modalComplete"
            :id="publishedSetupId"
            @continue="reset"
        />

        <Button
            tooltip="セットアップを投稿"
            :icon="!publishing ? 'lucide:upload' : 'i-svg-spinners-ring-resize'"
            :icon-size="18"
            variant="flat"
            class="fixed lg:hidden bottom-3 right-3 rounded-full p-4 whitespace-nowrap hover:bg-zinc-700 hover:text-zinc-200 dark:text-zinc-900 dark:bg-zinc-300 hover:dark:text-zinc-100"
            @click="modalConfirm = true"
        />

        <SetupsEditPreview
            v-model:vis="modalPreview"
            :created-at="new Date().toISOString()"
            :title="title"
            :description="description"
            :tags="tags"
            :co-authors="coAuthors"
            :unity="unity"
            :image="image"
            :items="items"
            class="overflow-y-auto"
        />

        <ModalPublishSetupConfirm v-model="modalConfirm" :image-src="image" />
    </div>
</template>
