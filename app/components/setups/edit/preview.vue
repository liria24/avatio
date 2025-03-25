<script lang="ts" setup>
const vis = defineModel<boolean>('vis', {
    default: false,
    required: true,
});

const { title, description, tags, coAuthors, unity, image, items } =
    defineProps<{
        title: string;
        description: string;
        tags: string[];
        coAuthors: Array<{ id: string; name: string; note: string }>;
        unity: string | null;
        image: File | null;
        items: Record<string, SetupItem[]>;
    }>();

const imageObjectUrl = computed(() => {
    if (!image) return null;
    return URL.createObjectURL(image);
});
</script>

<template>
    <Modal v-model="vis" class="max-w-4xl">
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
</template>
