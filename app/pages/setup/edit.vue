<script setup lang="ts">
import { z } from 'zod';

const skipRouterHook = ref(false);

const publishing = ref(false);
const publishedSetupId = ref<number | null>(null);
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
const coAuthors = ref<
    {
        id: string;
        name: string;
        avatar: string;
        note: string;
    }[]
>([]);
const unity = ref<string>('');
const image = ref<File | null>(null);
const imageObjectUrl = computed(() => {
    if (!image.value) return null;
    return URL.createObjectURL(image.value);
});

const editImage = ref();

const itemsFlatten = computed(() => [
    ...items.value.avatar,
    ...items.value.cloth,
    ...items.value.accessory,
    ...items.value.hair,
    ...items.value.texture,
    ...items.value.shader,
    ...items.value.tool,
    ...items.value.other,
]);

const limits = setupLimits();

const setupSchema = z.object({
    name: z
        .string()
        .min(1, 'タイトルを入力してください。')
        .max(limits.title, `タイトルは最大${limits.title}字までです。`),
    description: z
        .string()
        .max(limits.description, `説明は最大${limits.description}字までです。`),
    tags: z
        .array(z.string())
        .max(limits.tags, `タグの数は最大${limits.tags}個までです。`),
    coAuthors: z
        .array(
            z.object({
                id: z.string(),
                note: z
                    .string()
                    .max(
                        limits.coAuthorsNote,
                        `共同作者のメモは最大${limits.coAuthorsNote}字までです。`
                    ),
            })
        )
        .max(
            limits.coAuthors,
            `共同作者の数は最大${limits.coAuthors}人までです。`
        ),
    unity: z
        .string()
        .max(limits.unity, `Unityのバージョンは最大${limits.unity}字までです。`)
        .nullable(),
    items: z
        .array(z.any())
        .min(1, '最低1つのアイテムが必要です')
        .max(limits.items, `アイテムの最大数は${limits.items}個です。`),
    image: z
        .string()
        .nullable()
        .refine(
            (file) => !file || file.length <= 4.5 * 1024 * 1024,
            '画像サイズが大きすぎます。3.5MB以下の画像が推奨されます。'
        ),
});

const errorCheck = async (data: z.infer<typeof setupSchema>) => {
    const result = setupSchema.safeParse(data);

    if (!result.success) {
        publishing.value = false;
        const firstError = result.error.errors[0];
        if (firstError?.message) useToast().add(firstError.message);

        return true;
    }
    return false;
};

const PublishSetup = async () => {
    publishing.value = true;

    const data = {
        name: title.value,
        description: description.value,
        unity: unity.value.length ? unity.value : null,
        tags: tags.value,
        coAuthors: coAuthors.value.map((i) => ({
            id: i.id,
            note: i.note,
        })),
        items: itemsFlatten.value.map((i) => ({
            id: i.id,
            category: i.category,
            note: i.note,
            unsupported: i.unsupported,
        })),
        image: image.value ? await convertFileToBase64(image.value) : null,
    };

    if (await errorCheck(data)) return (publishing.value = false);

    type res = ApiResponse<{ id: number; image: string | null }>;
    const response = await $fetch<res>('/api/setup', {
        method: 'PUT',
        body: data,
    });
    console.log(response);

    if (!response.data) {
        publishing.value = false;
        return useToast().add('投稿に失敗しました');
    }

    publishedSetupId.value = response.data.id;
    publishing.value = false;
    skipRouterHook.value = true;
    modalComplete.value = true;
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
    editImage.value.reset();
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
        itemsFlatten.value.length;

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
            @publish="PublishSetup"
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
            @click="PublishSetup"
        />

        <Modal v-model="modalPreview" class="max-w-4xl">
            <SetupsViewer
                preview
                :title="title"
                :description="description"
                :tags="tags"
                :co-authors="coAuthors"
                :unity="unity"
                :author="{
                    id: userProfile.id!,
                    name: userProfile.name!,
                    avatar: userProfile.avatar,
                    badges: userProfile.badges,
                }"
                :preview-images="imageObjectUrl ? [imageObjectUrl] : []"
                :items="items"
            />
        </Modal>
    </div>
</template>
