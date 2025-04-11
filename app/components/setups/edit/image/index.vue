<script lang="ts" setup>
const image = defineModel<Blob | null>({
    default: null,
});

const processingImage = ref<File | null>(null);
const imagePreview = ref<string | null>(null);

const dropZoneRef = ref<HTMLButtonElement>();

watchEffect(() => {
    if (imagePreview.value?.startsWith('blob:'))
        URL.revokeObjectURL(imagePreview.value);

    imagePreview.value = image.value ? URL.createObjectURL(image.value) : null;
});

const resetImage = () => {
    reset();
    image.value = null;
};

const { open, reset, onChange } = useFileDialog({
    accept: 'image/png, image/jpeg, image/webp, image/tiff',
    multiple: false,
});

const handleFiles = (files: FileList | File[] | null) => {
    if (files?.length && files[0]) processingImage.value = files[0];
    else resetImage();
};

onChange(handleFiles);

const { isOverDropZone } = useDropZone(dropZoneRef, {
    onDrop: handleFiles,
    dataTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/tiff'],
    multiple: false,
    preventDefaultForUnhandled: false,
});

onBeforeUnmount(() => {
    if (imagePreview.value?.startsWith('blob:'))
        URL.revokeObjectURL(imagePreview.value);
});

defineExpose({ reset: resetImage });
</script>

<template>
    <div class="w-full h-42 block">
        <SetupsEditImageProcessor
            v-if="processingImage"
            v-model:processing="processingImage"
            v-model:processed="image"
        />
        <template v-else>
            <button
                v-if="!imagePreview"
                ref="dropZoneRef"
                type="button"
                @click="open()"
                :class="[
                    'w-full h-full flex flex-col items-center justify-center rounded-xl cursor-pointer',
                    'border-4 border-dashed border-zinc-300 dark:border-zinc-600',
                    isOverDropZone
                        ? 'bg-zinc-500 dark:bg-zinc-400'
                        : 'hover:bg-zinc-200 dark:hover:bg-black/15',
                ]"
            >
                <Icon
                    name="lucide:plus"
                    class="text-4xl text-zinc-400 dark:text-zinc-500"
                />
                <span class="font-medium text-zinc-400 dark:text-zinc-500">
                    画像を追加
                </span>
            </button>
            <div v-else class="h-full flex items-center gap-2 justify-center">
                <div
                    class="relative h-full object-cover rounded-xl overflow-hidden"
                >
                    <NuxtImg
                        :src="imagePreview"
                        alt="Image Preview"
                        class="h-full"
                    />
                    <button
                        @click="resetImage()"
                        class="size-8 absolute top-2 right-2 bg-black/30 hover:bg-black/70 rounded-full p-1 backdrop-blur-lg flex items-center justify-center cursor-pointer"
                    >
                        <Icon name="lucide:x" class="size-full text-zinc-100" />
                    </button>
                </div>
            </div>
        </template>
    </div>
</template>
