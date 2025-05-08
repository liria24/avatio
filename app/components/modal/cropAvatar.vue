<script lang="ts" setup>
import { CircleStencil, Cropper, Preview } from 'vue-advanced-cropper';
import 'vue-advanced-cropper/dist/style.css';

const MAX_FILE_SIZE = 1.5 * 1024 * 1024; // 1.5MB
const MAX_DIMENSION = 512; // 512px

const vis = defineModel<boolean>({
    required: true,
    default: false,
});

const emit = defineEmits<{
    (e: 'submit', file: File): void;
}>();

interface Props {
    avatar: File | null;
}
const props = defineProps<Props>();

const avatarObjectURL = ref<string | null>(null);
watchEffect(() => {
    if (!props.avatar) {
        if (avatarObjectURL.value) URL.revokeObjectURL(avatarObjectURL.value);
        avatarObjectURL.value = null;
    } else {
        if (avatarObjectURL.value) URL.revokeObjectURL(avatarObjectURL.value);
        avatarObjectURL.value = URL.createObjectURL(props.avatar);
    }
});

onUnmounted(() => {
    if (avatarObjectURL.value) {
        URL.revokeObjectURL(avatarObjectURL.value);
        avatarObjectURL.value = null;
    }
});

const cropperRef = ref<InstanceType<typeof Cropper> | null>(null);

const croppedImage = ref<{
    image: { src: string };
    coordinates: object;
} | null>(null);

const onCropChange = (data: {
    image: { src: string };
    coordinates: object;
}) => {
    croppedImage.value = data;
};

const resizeCanvas = (canvas: HTMLCanvasElement): HTMLCanvasElement => {
    const resizedCanvas = document.createElement('canvas');
    const ctx = resizedCanvas.getContext('2d');
    if (!ctx) {
        console.error('Failed to get canvas context');
        throw new Error('Failed to get canvas context');
    }

    let { width, height } = canvas;

    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
        width = Math.floor(width * ratio);
        height = Math.floor(height * ratio);
    }

    resizedCanvas.width = width;
    resizedCanvas.height = height;
    ctx.drawImage(canvas, 0, 0, width, height);

    return resizedCanvas;
};

const createBlobWithQuality = (
    canvas: HTMLCanvasElement,
    mimeType: string,
    quality: number
): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (!blob) {
                    const error = new Error(
                        'Failed to create blob from canvas'
                    );
                    console.error(error);
                    reject(error);
                    return;
                }
                resolve(blob);
            },
            mimeType,
            quality
        );
    });
};

const createFile = (
    blob: Blob,
    mimeType: string,
    filename: string = ''
): File => {
    const extension = mimeType.split('/')[1] || 'png';
    const finalFilename = filename || `avatar.${extension}`;

    return new File([blob], finalFilename, { type: mimeType });
};

const canvasToFile = async (
    mimeType: string = 'image/png',
    quality: number = 0.9,
    filename: string = ''
): Promise<File | null> => {
    if (!cropperRef.value) {
        console.error('Cropper reference is not available');
        return null;
    }

    const { canvas } = cropperRef.value.getResult();
    if (!canvas) {
        console.error('Canvas is not available from cropper result');
        return null;
    }

    try {
        const resizedCanvas = resizeCanvas(canvas);

        let currentQuality = quality;
        let blob = await createBlobWithQuality(
            resizedCanvas,
            mimeType,
            currentQuality
        );

        while (blob.size > MAX_FILE_SIZE && currentQuality > 0.2) {
            currentQuality = Math.max(0.2, currentQuality - 0.1);
            console.log(
                `File size ${(blob.size / 1024 / 1024).toFixed(2)}MB exceeds limit. Reducing quality to ${currentQuality}`
            );

            blob = await createBlobWithQuality(
                resizedCanvas,
                mimeType,
                currentQuality
            );
        }

        // Create file
        return createFile(blob, mimeType, filename);
    } catch (error) {
        console.error('Error processing image:', error);
        return null;
    }
};

const submitCroppedImage = async () => {
    const mimeType = props.avatar?.type || 'image/png';

    try {
        const file = await canvasToFile(mimeType, 0.9);
        if (file) {
            emit('submit', file);
            if (avatarObjectURL.value) {
                URL.revokeObjectURL(avatarObjectURL.value);
            }
        }
    } catch (error) {
        console.error('Failed to create cropped image:', error);
    } finally {
        avatarObjectURL.value = null;
        vis.value = false;
    }
};
</script>

<template>
    <Modal v-model="vis">
        <div
            class="flex flex-col items-center gap-5 overflow-y-auto overflow-x-hidden"
        >
            <cropper
                v-if="avatarObjectURL"
                ref="cropperRef"
                :src="avatarObjectURL"
                :stencil-component="CircleStencil"
                :auto-zoom="true"
                :debounce="false"
                class="shrink-0 rounded-lg overflow-hidden"
                @change="onCropChange"
            />
            <div
                v-if="croppedImage"
                class="flex items-center justify-center gap-4"
            >
                <preview
                    :width="100"
                    :height="100"
                    :image="croppedImage.image"
                    :coordinates="croppedImage.coordinates"
                    class="shrink-0 rounded-full overflow-hidden"
                />
                <preview
                    :width="64"
                    :height="64"
                    :image="croppedImage.image"
                    :coordinates="croppedImage.coordinates"
                    class="shrink-0 rounded-full overflow-hidden"
                />
                <preview
                    :width="32"
                    :height="32"
                    :image="croppedImage.image"
                    :coordinates="croppedImage.coordinates"
                    class="shrink-0 rounded-full overflow-hidden"
                />
            </div>
        </div>

        <template #footer>
            <div class="gap-1.5 flex items-center justify-between">
                <Button
                    label="キャンセル"
                    variant="flat"
                    @click="vis = false"
                />
                <Button @click="submitCroppedImage">
                    <Icon
                        name="lucide:check"
                        size="18"
                        class="text-zinc-600 dark:text-zinc-300"
                    />
                    <span class="hidden md:inline">保存</span>
                </Button>
            </div>
        </template>
    </Modal>
</template>
