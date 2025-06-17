<script lang="ts" setup>
interface Props {
    preview?: boolean
    setupId?: number
    createdAt?: string
    title: string
    description?: string | null
    tags?: string[]
    coAuthors?: (User & { note: string | null })[]
    user: User
    images?: { url: string; width: number; height: number }[]
    previewImages?: string[]
    items: SetupItem[]
}
const props = defineProps<Props>()

const emit = defineEmits(['login'])

const session = await useGetSession()

const bookmark = ref(false)
const bookmarkButtonStyle = computed(() => ({
    icon: bookmark.value ? 'lucide:bookmark-x' : 'lucide:bookmark',
    label: bookmark.value ? 'ブックマークから削除' : 'ブックマーク',
}))

// const categories: Record<string, { label: string; icon: string }> =
//     itemCategories()
</script>

<template>
    <div class="relative flex w-full flex-col items-start gap-8 xl:flex-row">
        <div class="flex w-full flex-col items-center gap-4">
            <div class="flex w-full flex-col items-start gap-1">
                <h1
                    class="text-highlighted text-3xl font-bold wrap-anywhere break-keep"
                >
                    {{ lineBreak(props.title) }}
                </h1>
                <div class="flex w-full items-center justify-between gap-3">
                    <div class="ml-0.5 flex items-center gap-1.5">
                        <Icon
                            name="lucide:calendar"
                            size="16"
                            class="text-muted"
                        />
                        <NuxtTime
                            v-if="props.createdAt?.length"
                            :datetime="props.createdAt"
                            class="text-muted font-[Geist] text-sm leading-none text-nowrap"
                        />
                    </div>
                    <div v-if="!preview" class="flex items-center gap-0.5">
                        <UButton
                            v-if="session?.user.id !== props.user.id"
                            :icon="bookmarkButtonStyle.icon"
                            :aria-label="bookmarkButtonStyle.label"
                            variant="ghost"
                            size="sm"
                            class="p-2"
                        />

                        <UButton
                            v-if="session?.user.id !== props.user.id"
                            icon="lucide:flag"
                            aria-label="報告"
                            variant="ghost"
                            size="sm"
                            class="p-2"
                        />

                        <UButton
                            v-if="session?.user.id === props.user.id"
                            tooltip="削除"
                            aria-label="削除"
                            icon="lucide:trash"
                            variant="ghost"
                            size="sm"
                            class="p-2"
                        />

                        <UButton
                            icon="lucide:share-2"
                            aria-label="シェア"
                            variant="ghost"
                            size="sm"
                            class="p-2"
                        />
                    </div>
                </div>
            </div>

            <!-- <UiImage
                v-if="props.images?.length && !props.preview"
                :src="props.images[0]!.url"
                :alt="props.title"
                :width="props.images[0]!.width ?? 640"
                :height="props.images[0]!.height ?? 320"
                class="max-h-[900px] w-full shrink-0 grow-0 object-contain"
            />
            <UiImage
                v-if="props.previewImages?.length && props.preview"
                :src="props.previewImages[0]!"
                :alt="props.title"
                :width="640"
                :height="320"
                class="max-h-[900px] w-full shrink-0 grow-0 object-contain"
            /> -->

            <div class="mt-3 flex w-full flex-col gap-5 xl:hidden">
                <SetupsViewerInfo
                    :preview="props.preview"
                    :setup-id="props.setupId"
                    :created-at="props.createdAt"
                    :title="props.title"
                    :description="props.description"
                    :tags="props.tags"
                    :co-authors="props.coAuthors"
                    :user="props.user"
                    class="w-full"
                    @login="emit('login')"
                />
            </div>

            <div class="mt-3 flex w-full flex-col gap-7">
                <div
                    v-for="(value, key) in props.items"
                    :key="'category-' + key"
                    class="flex flex-col gap-5 empty:hidden"
                >
                    <!-- <template v-if="value.length">
                        <UiTitle
                            :label="categories[key]?.label || key"
                            :icon="categories[key]?.icon"
                            is="h2"
                        />
                        <SetupsViewerItem
                            v-for="(item, index) in value"
                            :key="`item-${key}-${index}`"
                            :size="key === 'avatar' ? 'lg' : 'md'"
                            :item="item"
                        />
                    </template> -->
                </div>
            </div>
        </div>

        <div class="hidden h-full w-full flex-col xl:flex xl:w-[440px]">
            <SetupsViewerInfo
                :preview="props.preview"
                :setup-id="props.setupId"
                :created-at="props.createdAt"
                :title="props.title"
                :description="props.description"
                :tags="props.tags"
                :co-authors="props.coAuthors"
                :user="props.user"
                class="sticky top-3 pt-3"
                @login="emit('login')"
            />
        </div>
    </div>
</template>
