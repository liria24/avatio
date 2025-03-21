<script lang="ts" setup>
import { twMerge } from 'tailwind-merge';

const emit = defineEmits(['publish', 'preview']);

const title = defineModel<string>('title', { default: '' });
const description = defineModel<string>('description', { default: '' });
const tags = defineModel<string[]>('tags', { default: [] });
const coAuthors = defineModel<
    {
        id: string;
        name: string;
        avatar: string;
        note: string;
    }[]
>('coAuthors', { default: [] });
const unity = defineModel<string>('unity', { default: '' });
const image = defineModel<File | null>('image', { default: null });
const publishing = defineModel<boolean>('publishing', { default: false });

const { class: propClass } = defineProps<{ class?: string | string[] }>();

const router = useRouter();

const attributesVisibility = ref({
    coAuthors: false,
    unity: false,
});
</script>

<template>
    <div
        :class="
            twMerge(
                'relative rounded-lg',
                'flex flex-col',
                'lg:ring-2 ring-zinc-200 dark:ring-zinc-700',
                'lg:bg-zinc-100 lg:dark:bg-zinc-800',
                propClass
            )
        "
    >
        <div
            class="hidden lg:flex z-[1] sticky top-0 left-0 right-0 p-5 gap-1 flex-col bg-zinc-100 dark:bg-zinc-800"
        >
            <Button
                :label="!publishing ? '公開' : '処理中'"
                :icon="
                    !publishing ? 'lucide:upload' : 'i-svg-spinners-ring-resize'
                "
                :icon-size="18"
                variant="flat"
                :class="[
                    'grow rounded-full px-4 whitespace-nowrap',
                    'bg-zinc-600 hover:bg-zinc-300 hover:dark:bg-zinc-700  dark:bg-zinc-300',
                    'text-zinc-200 hover:text-zinc-600 dark:text-zinc-900 hover:dark:text-zinc-100',
                ]"
                @click="emit('publish')"
            >
            </Button>

            <div class="grid grid-cols-2 gap-1 items-center">
                <Button
                    label="プレビュー"
                    icon="lucide:scan-eye"
                    :icon-size="18"
                    variant="flat"
                    class="rounded-full"
                    @click="emit('preview')"
                />
                <Button
                    label="破棄"
                    icon="lucide:trash"
                    :icon-size="18"
                    variant="flat"
                    class="rounded-full"
                    @click="router.back()"
                />
            </div>
        </div>

        <div class="p-5 pt-2 flex flex-col gap-8">
            <div class="w-full flex flex-col items-start gap-3">
                <div class="w-full flex gap-2 items-center justify-between">
                    <UiTitle label="タイトル" icon="lucide:text" />
                    <UiCount
                        v-if="title.length"
                        :count="title.length"
                        :max="setupLimits().title"
                    />
                </div>
                <UiTextarea
                    v-model="title"
                    placeholder="セットアップ名"
                    class="w-full"
                />
            </div>

            <div
                class="grid grid-flow-row sm:grid-cols-2 lg:grid-cols-1 lg:grid-flow-row gap-8"
            >
                <div class="w-full flex flex-col items-start gap-3">
                    <div class="w-full flex gap-2 items-center justify-between">
                        <UiTitle label="画像" icon="lucide:image" />
                        <PopupUploadImage>
                            <button
                                type="button"
                                class="cursor-pointer flex items-center gap-1"
                            >
                                <Icon
                                    name="lucide:info"
                                    class="text-indigo-400 dark:text-indigo-300"
                                />
                                <span
                                    class="text-xs font-medium text-zinc-600 dark:text-zinc-300"
                                >
                                    画像の添付について
                                </span>
                            </button>
                        </PopupUploadImage>
                    </div>
                    <SetupsEditImage ref="editImage" v-model="image" />
                </div>

                <div class="flex flex-col gap-8">
                    <div class="w-full flex flex-col items-start gap-3">
                        <div
                            class="w-full flex gap-2 items-center justify-between"
                        >
                            <UiTitle label="説明" icon="lucide:text" />
                            <UiCount
                                v-if="description.length"
                                :count="description.length"
                                :max="setupLimits().description"
                            />
                        </div>
                        <UiTextarea
                            v-model="description"
                            placeholder="説明"
                            class="w-full"
                        />
                    </div>

                    <div class="w-full flex flex-col items-start gap-3">
                        <div
                            class="w-full flex gap-2 items-center justify-between"
                        >
                            <UiTitle label="タグ" icon="lucide:tags" />
                            <UiCount
                                v-if="tags.length"
                                :count="tags.length"
                                :max="setupLimits().tags"
                            />
                        </div>
                        <SetupsEditTags v-model="tags" />
                    </div>
                </div>

                <div
                    v-if="attributesVisibility.coAuthors"
                    class="w-full flex flex-col items-start gap-3"
                >
                    <div class="w-full flex gap-2 items-center justify-between">
                        <div
                            class="w-full flex items-center gap-1 justify-between"
                        >
                            <UiTitle
                                label="共同作者"
                                icon="lucide:users-round"
                            />
                            <Button
                                variant="flat"
                                class="p-1.5"
                                @click="attributesVisibility.coAuthors = false"
                            >
                                <Icon
                                    name="lucide:x"
                                    size="18"
                                    class="text-zinc-400"
                                />
                            </Button>
                        </div>
                        <UiCount
                            v-if="coAuthors.length"
                            :count="coAuthors.length"
                            :max="setupLimits().coAuthors"
                        />
                    </div>
                    <SetupsEditCoAuthor v-model="coAuthors" />
                </div>

                <div
                    v-if="attributesVisibility.unity"
                    class="w-full flex flex-col items-start gap-3"
                >
                    <div class="w-full flex gap-2 items-center justify-between">
                        <div
                            class="w-full flex items-center gap-1 justify-between"
                        >
                            <UiTitle
                                label="Unity バージョン"
                                icon="simple-icons:unity"
                            />
                            <Button
                                variant="flat"
                                class="p-1.5"
                                @click="attributesVisibility.unity = false"
                            >
                                <Icon
                                    name="lucide:x"
                                    size="18"
                                    class="text-zinc-400"
                                />
                            </Button>
                        </div>

                        <UiCount
                            v-if="unity.length"
                            :count="unity.length"
                            :max="setupLimits().unity"
                        />
                    </div>
                    <UiTextinput
                        v-model="unity"
                        placeholder="例: 2022.3.22f1"
                        class="w-full"
                    />
                </div>

                <Popup
                    v-if="
                        !attributesVisibility.coAuthors ||
                        !attributesVisibility.unity
                    "
                    class="p-1"
                >
                    <template #trigger>
                        <Button
                            variant="outline"
                            class="col-span-1 sm:col-span-2 lg:col-span-1"
                        >
                            <Icon
                                name="lucide:plus"
                                size="18"
                                class="text-zinc-400"
                            />
                            <span>アトリビュートを追加</span>
                        </Button>
                    </template>

                    <template #content>
                        <div class="flex flex-col gap-0.5 text-sm min-w-32">
                            <PopoverClose
                                v-if="!attributesVisibility.coAuthors"
                            >
                                <Button
                                    variant="flat"
                                    class="w-full"
                                    @click="
                                        attributesVisibility.coAuthors = true
                                    "
                                >
                                    <Icon
                                        name="lucide:users-round"
                                        size="18"
                                        class="text-zinc-400"
                                    />
                                    <span>共同作者</span>
                                </Button>
                            </PopoverClose>
                            <PopoverClose v-if="!attributesVisibility.unity">
                                <Button
                                    variant="flat"
                                    class="w-full"
                                    @click="attributesVisibility.unity = true"
                                >
                                    <Icon
                                        name="simple-icons:unity"
                                        size="18"
                                        class="text-zinc-400"
                                    />
                                    <span>Unity バージョン</span>
                                </Button>
                            </PopoverClose>
                        </div>
                    </template>
                </Popup>
            </div>
        </div>
    </div>
</template>
