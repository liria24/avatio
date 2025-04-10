<script lang="ts" setup>
const image = defineModel<Blob | null>({
    default: null,
});

const imagePreview = ref<string | null>(null);
const dropZoneRef = ref<HTMLDivElement>();
const fileName = ref<string>('');
const processing = ref(false);

// Blob URLのクリーンアップ
const cleanupBlobUrl = () => {
    if (imagePreview.value?.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview.value);
        imagePreview.value = null;
    }
};

// 画像リセット処理
const resetImage = () => {
    reset();
    image.value = null;
    fileName.value = '';
    cleanupBlobUrl();
};

// 画像処理関数
const processImage = (file: File) => {
    processing.value = true;
    fileName.value = file.name;

    // 既存のBlobをクリーンアップ
    cleanupBlobUrl();

    fileToBase64(file)
        .then((base64Image) => useCompressImage(base64Image, 1920))
        .then((compressedBlob) => {
            image.value = compressedBlob;
            imagePreview.value = URL.createObjectURL(compressedBlob);
        })
        .catch((error) => {
            console.error('画像処理に失敗しました:', error);
            resetImage();
        })
        .finally(() => {
            processing.value = false;
        });
};

const { open, reset, onChange } = useFileDialog({
    accept: 'image/png, image/jpeg, image/webp, image/tiff',
    multiple: false,
});

// ファイル選択時の処理
onChange((files) =>
    files?.length && files[0] ? processImage(files[0]) : resetImage()
);

// ドロップ時の処理
const onDrop = (files: File[] | null) =>
    files?.length === 1 && files[0] ? processImage(files[0]) : resetImage();

const { isOverDropZone } = useDropZone(dropZoneRef, {
    onDrop,
    dataTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/tiff'],
    multiple: false,
    preventDefaultForUnhandled: false,
});

// コンポーネントのアンマウント時にリソースをクリーンアップ
onBeforeUnmount(cleanupBlobUrl);

defineExpose({
    reset: resetImage,
});
</script>

<template>
    <div class="w-full flex flex-col gap-3 items-start">
        <Icon v-if="processing" name="svg-spinners:ring-resize" :size="24" />
        <template v-else>
            <button
                v-if="!imagePreview"
                ref="dropZoneRef"
                type="button"
                @click="open()"
                :class="[
                    'h-40 w-full flex flex-col items-center justify-center',
                    'rounded-xl cursor-pointer',
                    'border-4 border-dashed border-zinc-300 dark:border-zinc-600',
                    isOverDropZone
                        ? 'bg-zinc-500 dark:bg-zinc-400'
                        : 'hover:bg-zinc-200 dark:hover:bg-black/15 ',
                ]"
            >
                <Icon
                    name="lucide:plus"
                    class="text-4xl text-zinc-400 dark:text-zinc-500"
                />
                <span class="font-medium text-zinc-400 dark:text-zinc-500"
                    >画像を追加</span
                >
            </button>
            <div v-else class="flex flex-col items-center gap-1 h-fit">
                <div class="relative w-auto h-fit">
                    <NuxtImg
                        :src="imagePreview"
                        alt="Image Preview"
                        class="object-contain max-h-64 rounded-xl"
                    />
                    <button
                        @click="resetImage()"
                        class="size-8 absolute top-2 right-2 bg-black/30 hover:bg-black/70 rounded-full p-1 backdrop-blur-lg"
                    >
                        <Icon name="lucide:x" class="size-full bg-zinc-100" />
                    </button>
                </div>
                <div
                    v-if="fileName"
                    class="w-full line-clamp-1 break-all text-xs px-1 text-zinc-600 dark:text-zinc-400"
                >
                    {{ fileName }}
                </div>
            </div>
        </template>
    </div>
</template>
