<script lang="ts" setup>
import { twMerge } from 'tailwind-merge'

const emit = defineEmits(['publish', 'preview'])

const title = defineModel<string>('title', { default: '' })
const description = defineModel<string>('description', { default: '' })
const tags = defineModel<string[]>('tags', { default: [] })
const coAuthors = defineModel<CoAuthor[]>('coAuthors', { default: [] })
const unity = defineModel<string>('unity', { default: '' })
const image = defineModel<Blob | null>('image', { default: null })
const publishing = defineModel<boolean>('publishing', { default: false })

const props = defineProps<{ class?: string | string[] }>()

const router = useRouter()
const workerSupported = ref(true)

const attributesVisibility = ref({
    coAuthors: false,
    unity: false,
})

const deleteCoAuthor = () => {
    attributesVisibility.value.coAuthors = false
    coAuthors.value = []
}

const deleteUnity = () => {
    attributesVisibility.value.unity = false
    unity.value = ''
}

onMounted(() => {
    if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined')
        workerSupported.value = false
})
</script>

<template>
    <div
        :class="
            twMerge(
                'relative rounded-lg',
                'flex flex-col',
                'ring-zinc-200 lg:ring-2 dark:ring-zinc-700',
                'lg:bg-zinc-100 lg:dark:bg-zinc-800',
                props.class
            )
        "
    >
        <div
            class="sticky top-0 right-0 left-0 z-[1] flex flex-col gap-1 p-5 lg:bg-zinc-100 lg:dark:bg-zinc-800"
        >
            <Button
                :label="!publishing ? '公開' : '処理中'"
                :icon="
                    !publishing ? 'lucide:upload' : 'i-svg-spinners-ring-resize'
                "
                :icon-size="18"
                variant="flat"
                :class="[
                    'hidden grow rounded-full px-4 whitespace-nowrap lg:flex',
                    'bg-zinc-600 hover:bg-zinc-300 dark:bg-zinc-300 hover:dark:bg-zinc-700',
                    'text-zinc-200 hover:text-zinc-600 dark:text-zinc-900 hover:dark:text-zinc-100',
                ]"
                @click="emit('publish')"
            >
            </Button>

            <div class="grid grid-cols-2 items-center gap-1">
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

        <div class="flex flex-col gap-8 p-5 pt-2">
            <div
                class="grid grid-flow-row gap-6 sm:grid-cols-2 lg:grid-flow-row lg:grid-cols-1"
            >
                <div class="flex w-full flex-col items-start gap-3">
                    <SetupsEditImage ref="editImage" v-model="image" />
                    <div class="flex flex-col items-end gap-1.5 self-end">
                        <PopupUploadImage>
                            <button
                                type="button"
                                class="flex cursor-pointer items-center gap-1"
                            >
                                <Icon
                                    name="lucide:info"
                                    size="16"
                                    class="text-indigo-400 dark:text-indigo-300"
                                />
                                <span
                                    class="text-xs font-medium text-zinc-600 dark:text-zinc-300"
                                >
                                    画像の添付について
                                </span>
                            </button>
                        </PopupUploadImage>

                        <Popup v-if="!workerSupported">
                            <template #trigger>
                                <button
                                    type="button"
                                    class="flex cursor-pointer items-center gap-1"
                                >
                                    <Icon
                                        name="lucide:triangle-alert"
                                        size="16"
                                        class="text-orange-400 dark:text-orange-300"
                                    />
                                    <span
                                        class="text-xs font-medium text-zinc-600 dark:text-zinc-300"
                                    >
                                        パフォーマンス警告
                                    </span>
                                </button>
                            </template>

                            <template #content>
                                <div
                                    class="flex flex-col gap-1.5 text-zinc-600 dark:text-zinc-400"
                                >
                                    <p class="text-sm/relaxed">
                                        お使いの環境では Web Worker
                                        がサポートされていないため、<br />
                                        画像処理でパフォーマンスが低下する可能性があります。
                                    </p>
                                    <p class="text-sm/relaxed">
                                        処理が完了するまでお待ちください。
                                    </p>
                                </div>
                            </template>
                        </Popup>
                    </div>
                </div>

                <div class="flex flex-col gap-8">
                    <div class="flex w-full flex-col items-start gap-3">
                        <div
                            class="flex w-full items-center justify-between gap-2"
                        >
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

                    <div class="flex w-full flex-col items-start gap-3">
                        <div
                            class="flex w-full items-center justify-between gap-2"
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

                    <div class="flex w-full flex-col items-start gap-3">
                        <div
                            class="flex w-full items-center justify-between gap-2"
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
                    class="flex w-full flex-col items-start gap-3"
                >
                    <div class="flex w-full items-center justify-between gap-2">
                        <UiTitle label="共同作者" icon="lucide:users-round" />
                        <div class="flex items-center gap-1">
                            <UiCount
                                v-if="coAuthors.length"
                                :count="coAuthors.length"
                                :max="setupLimits().coAuthors"
                            />
                            <Button
                                variant="flat"
                                class="p-1.5"
                                @click="deleteCoAuthor"
                            >
                                <Icon
                                    name="lucide:x"
                                    size="18"
                                    class="text-zinc-400"
                                />
                            </Button>
                        </div>
                    </div>
                    <SetupsEditCoAuthor v-model="coAuthors" />
                </div>

                <div
                    v-if="attributesVisibility.unity"
                    class="flex w-full flex-col items-start gap-3"
                >
                    <div class="flex w-full items-center justify-between gap-2">
                        <UiTitle
                            label="Unity バージョン"
                            icon="simple-icons:unity"
                        />
                        <div class="flex items-center gap-1">
                            <UiCount
                                v-if="unity.length"
                                :count="unity.length"
                                :max="setupLimits().unity"
                            />
                            <Button
                                variant="flat"
                                class="p-1.5"
                                @click="deleteUnity"
                            >
                                <Icon
                                    name="lucide:x"
                                    size="18"
                                    class="text-zinc-400"
                                />
                            </Button>
                        </div>
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
                            <span>項目を追加</span>
                        </Button>
                    </template>

                    <template #content>
                        <div class="flex min-w-32 flex-col gap-0.5 text-sm">
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
