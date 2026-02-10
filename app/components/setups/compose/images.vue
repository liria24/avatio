<script lang="ts" setup>
const { state, imageUploading, processImages, removeImage } = useSetupCompose()

const dropZoneRef = ref<HTMLDivElement>()

const { isOverDropZone } = useDropZone(dropZoneRef, {
    onDrop: processImages,
    dataTypes: ['image/jpg', 'image/jpeg', 'image/png', 'image/webp', 'image/tiff'],
    multiple: false,
    preventDefaultForUnhandled: true,
})

const { open, reset, onChange } = useFileDialog({
    accept: 'image/png, image/jpg, image/jpeg, image/webp, image/tiff',
    multiple: false,
    directory: false,
})

onChange(async (files) => {
    await processImages(files)
    reset()
})
</script>

<template>
    <div v-if="!state.images.length && !imageUploading" ref="dropZoneRef">
        <UButton
            :icon="isOverDropZone ? 'mingcute:download-fill' : 'mingcute:pic-fill'"
            :label="
                isOverDropZone ? $t('setup.compose.images.dropAdd') : $t('setup.compose.images.add')
            "
            variant="soft"
            block
            active-color="neutral"
            active-variant="subtle"
            :active="isOverDropZone"
            class="h-24 p-3"
            @click="open()"
        />
    </div>

    <div v-else-if="imageUploading" class="flex h-24 w-full items-center justify-center gap-2">
        <Icon name="svg-spinners:ring-resize" size="24" class="text-muted" />
        <p class="text-muted text-sm">{{ $t('setup.compose.images.uploading') }}</p>
    </div>

    <div v-else class="grid grid-cols-3 gap-2">
        <div v-for="(image, index) in state.images" :key="`image-${index}`" class="relative grid">
            <NuxtImg v-slot="{ isLoaded, src, imgAttrs }" :src="image" custom>
                <img
                    v-if="isLoaded"
                    v-bind="imgAttrs"
                    :src
                    :alt="`Setup image ${index + 1}`"
                    class="aspect-square size-full rounded-lg object-cover"
                />
                <USkeleton v-else class="aspect-square size-full rounded-lg" />
            </NuxtImg>
            <UButton
                icon="mingcute:close-line"
                color="neutral"
                size="xs"
                class="absolute top-1 right-1 z-10 rounded-full"
                @click="removeImage(index)"
            />
        </div>
    </div>
</template>
