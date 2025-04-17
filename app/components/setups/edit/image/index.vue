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
    <div class="relative w-full flex">
        <div
            v-if="processingImage"
            class="absolute inset-0 size-full bg-zinc-900/70"
        >
            <SetupsEditImageProcessor
                v-model:processing="processingImage"
                v-model:processed="image"
            />
        </div>
        <div class="w-full grid grid-cols-3 gap-3">
            <button
                v-if="!imagePreview"
                ref="dropZoneRef"
                type="button"
                @click="open()"
                :class="[
                    'col-span-3 h-24 flex flex-col gap-1 items-center justify-center rounded-xl cursor-pointer',
                    'border-4 border-dashed border-zinc-300 dark:border-zinc-600',
                    isOverDropZone
                        ? 'bg-zinc-500 dark:bg-zinc-400'
                        : 'hover:bg-zinc-200 dark:hover:bg-black/15',
                    'transition duration-150 ease-in-out',
                ]"
            >
                <Icon
                    name="lucide:plus"
                    size="24"
                    class="text-zinc-400 dark:text-zinc-500"
                />
                <span
                    class="text-sm font-bold text-zinc-400 dark:text-zinc-500"
                >
                    画像を追加
                </span>
            </button>
            <template v-else>
                <div class="relative h-full rounded-xl">
                    <NuxtImg
                        :src="imagePreview"
                        alt="Image Preview"
                        :class="[
                            'size-full aspect-square object-cover rounded-lg shadow-lg shadow-black',
                            '',
                        ]"
                        style="
                            mask-image: radial-gradient(
                                circle at 90% 10%,
                                transparent 16%,
                                black 17%
                            );
                            -webkit-mask-image: radial-gradient(
                                circle at 90% 10%,
                                transparent 16%,
                                black 17%
                            );
                        "
                    />
                    <button
                        @click="resetImage()"
                        :class="[
                            'size-8 absolute -top-1.5 -right-1.5 rounded-full p-1 cursor-pointer',
                            'flex items-center justify-center',
                            'bg-zinc-800 hover:bg-zinc-500 dark:bg-zinc-100 dark:hover:bg-zinc-400',
                            'transition duration-150 ease-in-out',
                        ]"
                    >
                        <Icon
                            name="lucide:x"
                            class="size-full text-zinc-100 dark:text-zinc-900"
                        />
                    </button>
                </div>
            </template>
        </div>
    </div>
</template>
