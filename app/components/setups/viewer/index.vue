<script lang="ts" setup>
interface Props {
    preview?: boolean;
    id?: number;
    createdAt?: string;
    title: string;
    description?: string | null;
    tags?: string[];
    coAuthors?: (Partial<Pick<CoAuthor, 'badges'>> &
        Omit<CoAuthor, 'badges'>)[];
    unity?: string | null;
    author: Author;
    images?: SetupImage[];
    previewImages?: string[];
    items: Record<string, SetupItem[]>;
}

const {
    preview,
    id,
    createdAt,
    title,
    description,
    tags,
    coAuthors,
    unity,
    author,
    images,
    items,
} = defineProps<Props>();

const emit = defineEmits(['login']);

const categories: Record<string, { label: string; icon: string }> =
    itemCategories();
</script>

<template>
    <div class="relative w-full flex flex-col xl:flex-row items-start gap-8">
        <div class="w-full flex flex-col items-center gap-4">
            <div class="w-full flex flex-col gap-1 items-start">
                <h1
                    class="text-3xl font-bold break-keep [overflow-wrap:anywhere;] text-black dark:text-white"
                >
                    {{ useSentence(title) }}
                </h1>
                <div class="w-full flex items-center gap-3 justify-between">
                    <div class="ml-1 flex gap-1.5 items-center">
                        <Icon
                            name="lucide:calendar"
                            size="16"
                            class="text-zinc-500 dark:text-zinc-400"
                        />
                        <p
                            v-if="createdAt?.length"
                            class="text-sm text-zinc-500 dark:text-zinc-400 whitespace-nowrap leading-none"
                        >
                            {{ useLocaledDate(new Date(createdAt)) }}
                        </p>
                    </div>
                    <SetupsViewerOperate
                        :preview="preview"
                        :id="id"
                        :title="title"
                        :description="description"
                        :author="author"
                        @login="emit('login')"
                    />
                </div>
            </div>

            <UiImage
                v-if="images?.length && !preview"
                :src="
                    useGetImage(images[0]!.name, {
                        prefix: 'setup',
                    })
                "
                :alt="title"
                :width="images[0]!.width ?? 640"
                :height="images[0]!.height ?? 320"
                class="w-full max-h-[70vh]"
            />
            <UiImage
                v-if="previewImages?.length && preview"
                :src="previewImages[0]!"
                :alt="title"
                :width="640"
                :height="320"
                class="w-full max-h-[70vh]"
            />

            <div class="xl:hidden w-full mt-3 flex flex-col gap-5">
                <SetupsViewerInfo
                    :preview="preview"
                    :id="id"
                    :created-at="createdAt"
                    :title="title"
                    :description="description"
                    :tags="tags"
                    :co-authors="coAuthors"
                    :unity="unity"
                    :author="author"
                    @login="emit('login')"
                    class="w-full"
                />
            </div>

            <div class="w-full mt-3 flex flex-col gap-7">
                <div
                    v-for="(value, key) in items"
                    :key="'category-' + key"
                    class="empty:hidden flex flex-col gap-5"
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

        <div class="w-full h-full xl:w-[440px] hidden xl:flex flex-col">
            <SetupsViewerInfo
                :preview="preview"
                :id="id"
                :created-at="createdAt"
                :title="title"
                :description="description"
                :tags="tags"
                :co-authors="coAuthors"
                :unity="unity"
                :author="author"
                @login="emit('login')"
                class="sticky top-3 pt-3"
            />
        </div>
    </div>
</template>
