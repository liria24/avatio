<script lang="ts" setup>
interface Props {
    preview?: boolean
    id?: number
    createdAt?: string
    title: string
    description?: string | null
    tags?: string[]
    coAuthors?: (Partial<Pick<CoAuthor, 'badges'>> & Omit<CoAuthor, 'badges'>)[]
    unity?: string | null
    author: Author
    images?: SetupImage[]
    previewImages?: string[]
    items: Record<string, SetupItem[]>
}

const props = defineProps<Props>()

const emit = defineEmits(['login'])

const categories: Record<string, { label: string; icon: string }> =
    itemCategories()
</script>

<template>
    <div class="relative flex w-full flex-col items-start gap-8 xl:flex-row">
        <div class="flex w-full flex-col items-center gap-4">
            <div class="flex w-full flex-col items-start gap-1">
                <h1
                    class="[overflow-wrap:anywhere;] text-3xl font-bold break-keep text-black dark:text-white"
                >
                    {{ lineBreak(props.title) }}
                </h1>
                <div class="flex w-full items-center justify-between gap-3">
                    <div class="my-2 ml-0.5 flex items-center gap-1.5">
                        <Icon
                            name="lucide:calendar"
                            size="16"
                            class="text-zinc-500 dark:text-zinc-400"
                        />
                        <NuxtTime
                            v-if="props.createdAt?.length"
                            :datetime="props.createdAt"
                            class="font-[Geist] text-sm leading-none whitespace-nowrap text-zinc-500 dark:text-zinc-400"
                        />
                    </div>
                    <SetupsViewerOperate
                        :preview="props.preview"
                        :id="props.id"
                        :title="props.title"
                        :description="props.description"
                        :author="props.author"
                        @login="emit('login')"
                    />
                </div>
            </div>

            <UiImage
                v-if="props.images?.length && !props.preview"
                :src="
                    getImage(props.images[0]!.name, {
                        prefix: 'setup',
                    })
                "
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
            />

            <div class="mt-3 flex w-full flex-col gap-5 xl:hidden">
                <SetupsViewerInfo
                    :preview="props.preview"
                    :id="props.id"
                    :created-at="props.createdAt"
                    :title="props.title"
                    :description="props.description"
                    :tags="props.tags"
                    :co-authors="props.coAuthors"
                    :unity="props.unity"
                    :author="props.author"
                    @login="emit('login')"
                    class="w-full"
                />
            </div>

            <div class="mt-3 flex w-full flex-col gap-7">
                <div
                    v-for="(value, key) in props.items"
                    :key="'category-' + key"
                    class="flex flex-col gap-5 empty:hidden"
                >
                    <template v-if="value.length">
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
                    </template>
                </div>
            </div>
        </div>

        <div class="hidden h-full w-full flex-col xl:flex xl:w-[440px]">
            <SetupsViewerInfo
                :preview="props.preview"
                :id="props.id"
                :created-at="props.createdAt"
                :title="props.title"
                :description="props.description"
                :tags="props.tags"
                :co-authors="props.coAuthors"
                :unity="props.unity"
                :author="props.author"
                @login="emit('login')"
                class="sticky top-3 pt-3"
            />
        </div>
    </div>
</template>
