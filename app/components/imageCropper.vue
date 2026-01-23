<script lang="ts" setup>
import type { Cropper } from 'vue-advanced-cropper'
import { CircleStencil, Preview } from 'vue-advanced-cropper'
import 'vue-advanced-cropper/dist/style.css'

const model = defineModel<Blob | null>({
    default: null,
})

const previewSizes = [100, 64, 32] as const
const originalImageURL = ref<string | null>(null)
const cropperRef = ref<InstanceType<typeof Cropper> | null>(null)
const croppedImage = ref<{
    image: { src: string }
    coordinates: object
} | null>(null)

let debounceTimer: NodeJS.Timeout | null = null

// URLクリーンアップ処理
const cleanupImageURL = () => {
    if (originalImageURL.value) {
        URL.revokeObjectURL(originalImageURL.value)
        originalImageURL.value = null
    }
}

// modelが変更されたときに元画像URLを設定
watch(
    model,
    (newValue) => {
        if (newValue && !originalImageURL.value) {
            originalImageURL.value = URL.createObjectURL(newValue)
        } else if (!newValue) {
            // modelがnullの場合はクリーンアップ
            cleanupImageURL()
        }
    },
    { immediate: true }
)

const onCropChange = async (data: {
    canvas?: HTMLCanvasElement
    image: { src: string }
    coordinates: object
}) => {
    croppedImage.value = data

    // 既存のタイマーをクリア
    if (debounceTimer) {
        clearTimeout(debounceTimer)
    }

    debounceTimer = setTimeout(async () => {
        if (!data.canvas) return

        try {
            const blob = await new Promise<Blob | null>((resolve) => {
                data.canvas!.toBlob(resolve, 'image/png')
            })

            if (blob) model.value = new Blob([blob], { type: 'image/png' })
        } catch (error) {
            console.error('Failed to generate blob from canvas:', error)
        }
    }, 300)
}

// クリーンアップ処理
onUnmounted(() => {
    cleanupImageURL()
    if (debounceTimer) {
        clearTimeout(debounceTimer)
    }
})
</script>

<template>
    <div class="flex flex-col items-center gap-5 overflow-x-hidden overflow-y-auto">
        <cropper
            v-if="originalImageURL"
            ref="cropperRef"
            :src="originalImageURL"
            :stencil-component="CircleStencil"
            :auto-zoom="true"
            :debounce="false"
            class="shrink-0 overflow-hidden rounded-lg"
            @change="onCropChange"
        />

        <div v-if="croppedImage" class="flex items-center justify-center gap-4">
            <preview
                v-for="size in previewSizes"
                :key="size"
                :width="size"
                :height="size"
                :image="croppedImage.image"
                :coordinates="croppedImage.coordinates"
                class="shrink-0 overflow-hidden rounded-full"
            />
        </div>
    </div>
</template>
