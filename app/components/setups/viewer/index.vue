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
    <div class="w-full flex flex-col xl:flex-row items-start gap-8">
        <div class="w-full flex flex-col items-center gap-8">
            <SetupsViewerHeader
                :preview="preview"
                :id="id"
                :created-at="createdAt"
                :title="title"
                :description="description"
                :author="author"
                @login="emit('login')"
            />

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

            <SetupsViewerInfo
                :description="description"
                :tags="tags"
                :co-authors="coAuthors"
                :unity="unity"
                class="xl:hidden"
            />

            <div class="w-full flex flex-col gap-5">
                <div
                    v-for="(value, key) in items"
                    :key="'category-' + key"
                    class="empty:hidden flex flex-col gap-3"
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

        <SetupsViewerInfo
            :description="description"
            :tags="tags"
            :co-authors="coAuthors"
            :unity="unity"
            class="w-full xl:w-[440px] xl:pt-12 hidden xl:flex"
        />
    </div>
</template>
