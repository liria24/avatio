<script lang="ts" setup>
const images = defineModel<string[]>({
    default: () => [],
})

const toast = useToast()

const imageUploading = ref(false)

const { open, reset, onChange } = useFileDialog({
    accept: 'image/png, image/jpg, image/jpeg, image/webp, image/tiff',
    multiple: false,
    directory: false,
})

onChange(async (files) => {
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
})

const removeImage = (index: number) => {
    if (index >= 0 && index < images.value.length) images.value.splice(index, 1)
}
</script>

<template>
    <UButton
        v-if="!images.length && !imageUploading"
        icon="lucide:image-plus"
        label="画像を追加"
        variant="soft"
        block
        class="h-24 p-3"
        @click="open()"
    />

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
