<script lang="ts" setup>
const image = defineModel<File | null>({
    default: null,
});

const imagePreview = ref<string | ArrayBuffer | null>(null);
const dropZoneRef = ref<HTMLDivElement>();

const { files, open, reset, onChange } = useFileDialog({
    accept: 'image/png, image/jpeg, image/webp, image/avif, image/tiff',
    multiple: false,
});

onChange((files) => {
    if (files?.length && files[0]) {
        const file = files[0];
        image.value = file;

        const reader = new FileReader();
        reader.onload = (e) => {
            if (!e.target) return;
            imagePreview.value = e.target.result;
        };
        reader.readAsDataURL(file);
    } else {
        image.value = null;
        imagePreview.value = null;
    }
});

const onDrop = (files: File[] | null) => {
    if (files && files.length === 1 && files[0]) {
        const file = files[0];
        image.value = file;

        const reader = new FileReader();
        reader.onload = (e) => {
            if (!e.target) return;
            imagePreview.value = e.target.result;
        };
        reader.readAsDataURL(file);
    } else {
        image.value = null;
        imagePreview.value = null;
    }
};

const { isOverDropZone } = useDropZone(dropZoneRef, {
    onDrop,
    dataTypes: [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/avif',
        'image/tiff',
    ],
    multiple: false,
    // whether to prevent default behavior for unhandled events
    preventDefaultForUnhandled: false,
});

defineExpose({
    reset,
});
</script>

<template>
    <div class="w-full flex flex-col gap-3 items-start">
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
        <div v-if="imagePreview" class="flex flex-col items-center gap-1 h-fit">
            <div class="relative w-auto h-fit">
                <NuxtImg
                    :src="imagePreview.toString()"
                    alt="Image Preview"
                    class="object-contain max-h-64 rounded-xl"
                />
                <button
                    @click="
                        reset();
                        image = null;
                        imagePreview = null;
                    "
                    class="size-8 absolute top-2 right-2 bg-black/30 hover:bg-black/70 rounded-full p-1 backdrop-blur-lg"
                >
                    <Icon name="lucide:x" class="size-full bg-zinc-100" />
                </button>
            </div>
            <div
                v-if="files && files.length && files[0]"
                class="w-full line-clamp-1 break-all text-xs px-1 text-zinc-600 dark:text-zinc-400"
            >
                {{ files[0].name }}
            </div>
        </div>
    </div>
</template>
