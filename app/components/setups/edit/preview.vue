<script lang="ts" setup>
import { twMerge } from 'tailwind-merge'

const vis = defineModel<boolean>('vis', {
    default: false,
    required: true,
})

const props = defineProps<{
    createdAt?: string
    title: string
    description: string
    tags: string[]
    coAuthors: Array<{ id: string; name: string; note: string }>
    unity: string | null
    image: Blob | null
    items: Record<string, SetupItem[]>
    class?: string | string[]
}>()

const imageObjectUrl = computed(() => {
    if (!props.image) return null
    return URL.createObjectURL(props.image)
})
</script>

<template>
    <Modal v-model="vis" :class="twMerge('max-w-4xl', props.class)">
        <SetupsViewer
            preview
            :created-at="props.createdAt"
            :title="props.title"
            :description="props.description"
            :tags="props.tags"
            :co-authors="props.coAuthors"
            :unity="props.unity"
            :author="{
                id: userProfile.id!,
                name: userProfile.name!,
                avatar: userProfile.avatar,
                badges: userProfile.badges,
            }"
            :preview-images="imageObjectUrl ? [imageObjectUrl] : []"
            :items="props.items"
        />
    </Modal>
</template>
