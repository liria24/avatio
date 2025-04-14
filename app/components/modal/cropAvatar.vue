<script lang="ts" setup>
import { CircleStencil, Cropper, Preview } from 'vue-advanced-cropper';
import 'vue-advanced-cropper/dist/style.css';

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

const canvasToFile = async (
    mimeType: string = 'image/png',
    quality: number = 0.9,
    filename: string = ''
): Promise<File | null> => {
    if (!cropperRef.value) return null;

    // クロップ結果を取得（canvas要素を含む）
    const { canvas } = cropperRef.value.getResult();
    if (!canvas) return null;

    // canvasからBlobを生成
    return new Promise<File | null>((resolve) => {
        canvas.toBlob(
            (blob) => {
                if (!blob) return resolve(null);

                const extension = mimeType.split('/')[1] || 'png';
                const finalFilename = filename || `avatar.${extension}`;

                // BlobからFileオブジェクトを生成
                const file = new File([blob], finalFilename, {
                    type: mimeType,
                });
                resolve(file);
            },
            mimeType,
            quality
        );
    });
};

const submitCroppedImage = async () => {
    // 画像のMIMEタイプを取得（元の画像と同じタイプを維持）
    const mimeType = props.avatar?.type || 'image/png';

    const file = await canvasToFile(mimeType, 0.9);
    if (file) {
        emit('submit', file);
        avatarObjectURL.value = null;
    }

    vis.value = false;
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
