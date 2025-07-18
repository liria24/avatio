<script lang="ts" setup>
const images = defineModel<string[]>({
    default: () => [],
})

const toast = useToast()

const dropZoneRef = ref<HTMLDivElement>()
const imageUploading = ref(false)

const processImages = async (files: FileList | File[] | null) => {
    if (!files?.length) return

    try {
        const file = files[0]
        if (!file) return

        const formData = new FormData()
        formData.append('blob', new Blob([file]))
        formData.append('path', 'setup')

        imageUploading.value = true
        const response = await $fetch('/api/images', {
            method: 'POST',
            body: formData,
        })

        if (response?.url) images.value.push(response.url)
    } catch (error) {
        console.error('Failed to upload image:', error)
        toast.add({
            title: '画像のアップロードに失敗しました',
            color: 'error',
        })
    } finally {
        imageUploading.value = false
        reset()
    }
}

const { isOverDropZone } = useDropZone(dropZoneRef, {
    onDrop: processImages,
    dataTypes: [
        'image/jpg',
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/tiff',
    ],
    multiple: false,
    preventDefaultForUnhandled: true,
})

const { open, reset, onChange } = useFileDialog({
    accept: 'image/png, image/jpg, image/jpeg, image/webp, image/tiff',
    multiple: false,
    directory: false,
})
onChange(processImages)

const removeImage = (index: number) => {
    if (index >= 0 && index < images.value.length) images.value.splice(index, 1)
}
</script>

<template>
    <div v-if="!images.length && !imageUploading" ref="dropZoneRef">
        <UButton
            :icon="isOverDropZone ? 'lucide:import' : 'lucide:image-plus'"
            :label="isOverDropZone ? 'ドロップして追加' : '画像を追加'"
            variant="soft"
            block
            active-color="neutral"
            active-variant="subtle"
            :active="isOverDropZone"
            class="h-24 p-3"
            @click="open()"
        />
    </div>

    <div
        v-else-if="imageUploading"
        class="flex h-24 w-full items-center justify-center gap-2"
    >
        <Icon name="svg-spinners:ring-resize" size="24" class="text-muted" />
        <p class="text-muted text-sm">画像をアップロード中...</p>
    </div>

    <div v-else class="grid grid-cols-3 gap-2">
        <div
            v-for="(image, index) in images"
            :key="`image-${index}`"
            class="relative grid"
        >
            <NuxtImg
                v-slot="{ isLoaded, src, imgAttrs }"
                :src="image"
                :alt="`Setup image ${index + 1}`"
                custom
                class="aspect-square size-full rounded-lg object-cover"
            >
                <img v-if="isLoaded" v-bind="imgAttrs" :src="src" />
                <USkeleton v-else class="aspect-square size-full rounded-lg" />
            </NuxtImg>
            <UButton
                icon="lucide:x"
                color="neutral"
                size="xs"
                class="absolute top-1 right-1 z-10 rounded-full"
                @click="removeImage(index)"
            />
        </div>
    </div>
</template>
