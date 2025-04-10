<script lang="ts" setup>
import { twMerge } from 'tailwind-merge';

const vis = defineModel<boolean>('vis', {
    default: false,
    required: true,
});

const {
    createdAt,
    title,
    description,
    tags,
    coAuthors,
    unity,
    image,
    items,
    class: classProp,
} = defineProps<{
    createdAt?: string;
    title: string;
    description: string;
    tags: string[];
    coAuthors: Array<{ id: string; name: string; note: string }>;
    unity: string | null;
    image: Blob | null;
    items: Record<string, SetupItem[]>;
    class?: string | string[];
}>();

const imageObjectUrl = computed(() => {
    if (!image) return null;
    return URL.createObjectURL(image);
});
</script>

<template>
    <Modal v-model="vis" :class="twMerge('max-w-4xl', classProp)">
        <SetupsViewer
            preview
            :created-at="createdAt"
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
</template>
