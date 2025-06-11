<script lang="ts" setup>
import { PhotonImage, resize, SamplingFilter } from '@silvia-odwyer/photon'

// 定数を抽出
const DEFAULT_MAX_SIZE = 1.5 * 1024 * 1024 // 1.5MB
const DEFAULT_RESOLUTION = 1920
const MIN_QUALITY = 20
const MAX_QUALITY = 90
const OPTIMIZATION_ITERATIONS = 5

const processingImage = defineModel<File | null>('processing', {
    default: null,
})
const processedImage = defineModel<Blob | null>('processed', { default: null })

watchEffect(async () => {
    if (!processingImage.value) return

    try {
        const base64Image = await fileToBase64(processingImage.value)
        const compressedBlob = await compressImage(
            base64Image,
            DEFAULT_RESOLUTION
        )
        processedImage.value = compressedBlob
    } catch (error) {
        console.error('画像処理に失敗しました:', error)
        useToast().add('画像処理に失敗しました')
    } finally {
        processingImage.value = null
    }
})

const compressImage = async (
    base64Image: string,
    resolution: number = DEFAULT_RESOLUTION,
    options?: {
        maxSize?: number
        onProgress?: (stage: string, percent: number) => void
    }
): Promise<Blob> => {
    const maxSize = options?.maxSize || DEFAULT_MAX_SIZE
    const onProgress = options?.onProgress || (() => {})

    // Web Worker対応チェック
    if (typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined')
        try {
            return await compressUsingWebWorker(
                base64Image,
                resolution,
                maxSize,
                onProgress
            )
        } catch (error) {
            console.warn(
                'Web Worker処理に失敗しました。メインスレッドで再試行します:',
                error
            )
        }
    else console.warn('Web Worker非対応環境: メインスレッドで処理します')

    return compressImageWasm(base64Image, resolution, maxSize, onProgress)
}

// Web Worker環境での画像圧縮
const compressUsingWebWorker = (
    base64Image: string,
    resolution: number,
    maxSize: number,
    onProgress: (stage: string, percent: number) => void
): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        let worker: Worker | undefined

        try {
            worker = new Worker(
                new URL('/workers/imageCompressor.worker.ts', import.meta.url),
                { type: 'module' }
            )

            worker.onmessage = ({ data }) => {
                if (data.type === 'progress')
                    onProgress(data.stage, data.percent)
                else if (data.type === 'result') {
                    const blob = new Blob([data.data], { type: 'image/jpeg' })
                    worker?.terminate()
                    resolve(blob)
                } else if (data.type === 'error') {
                    worker?.terminate()
                    reject(new Error(data.message))
                }
            }

            worker.onerror = (e) => {
                worker?.terminate()
                reject(new Error(`Worker エラー: ${e.message}`))
            }

            worker.postMessage({
                type: 'compress',
                imageData: base64Image,
                resolution,
                maxSize,
            })
        } catch (error) {
            worker?.terminate()
            reject(error instanceof Error ? error : new Error(String(error)))
        }
    })
}

const yieldToUI = () => new Promise((resolve) => setTimeout(resolve, 0))

// 最適な圧縮品質を探す
async function optimizeCompression<T extends ArrayBuffer | Uint8Array | Blob>(
    compress: (quality: number) => Promise<T>,
    maxSize: number,
    onProgress?: (i: number) => void
) {
    let min = MIN_QUALITY
    let max = MAX_QUALITY
    let bestQuality = min
    let bestData: T | null = null
    let bestSize = 0

    const getSize = (data: T) =>
        data instanceof Blob ? data.size : data.byteLength

    // 高品質で試行
    let data = await compress(max)
    let size = getSize(data)

    if (size <= maxSize) {
        return { bestQuality: max, bestData: data, size }
    }

    // 二分探索
    for (let i = 0; i < OPTIMIZATION_ITERATIONS; i++) {
        if (onProgress) onProgress(i)

        const quality = Math.floor((min + max) / 2)
        data = await compress(quality)
        size = getSize(data)

        if (size <= maxSize) {
            bestData = data
            bestQuality = quality
            bestSize = size
            min = quality
        } else {
            max = quality - 1
        }

        if (max - min <= 2) break
    }

    // 最低品質でフォールバック
    if (!bestData) {
        bestData = await compress(min)
        bestSize = getSize(bestData)
    }

    return { bestQuality, bestData, size: bestSize }
}

// リサイズ計算
function calcResize(width: number, height: number, resolution: number) {
    if (Math.max(width, height) <= resolution) return { width, height }

    const ratio = width / height
    return width > height
        ? { width: resolution, height: Math.round(resolution / ratio) }
        : { height: resolution, width: Math.round(resolution * ratio) }
}

const compressImageWasm = async (
    base64Image: string,
    resolution: number,
    maxSize: number,
    onProgress: (stage: string, percent: number) => void
): Promise<Blob> => {
    onProgress('画像読み込み中', 10)
    let photonImage: PhotonImage | null = null

    try {
        const imageData = base64Image.includes(',')
            ? base64Image.split(',')[1] || base64Image
            : base64Image

        // 画像読み込み
        const img = document.createElement('img')
        await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve()
            img.onerror = () => reject(new Error('画像読み込み失敗'))
            img.src = base64Image
        })

        onProgress('リサイズ処理中', 30)
        await yieldToUI()

        // Photon処理
        photonImage = PhotonImage.new_from_base64(imageData)
        await yieldToUI()

        // リサイズ処理
        const { width, height } = calcResize(
            img.naturalWidth,
            img.naturalHeight,
            resolution
        )

        if (width !== img.naturalWidth || height !== img.naturalHeight) {
            resize(photonImage, width, height, SamplingFilter.CatmullRom)
            await yieldToUI()
        }

        onProgress('画像圧縮中', 60)

        // 圧縮実行
        if (!photonImage) throw new Error('PhotonImage初期化失敗')

        const result = await optimizeCompression(
            (quality: number) =>
                Promise.resolve(photonImage!.get_bytes_jpeg(quality)),
            maxSize,
            (i) =>
                onProgress(
                    `圧縮最適化中 (${i + 1}/${OPTIMIZATION_ITERATIONS})`,
                    60 + i * 8
                )
        )

        onProgress('完了', 100)

        return new Blob([new Uint8Array(result.bestData)], {
            type: 'image/jpeg',
        })
    } catch (error) {
        throw error instanceof Error ? error : new Error(String(error))
    } finally {
        photonImage?.free()
    }
}
</script>

<template>
    <div class="flex size-full items-center justify-center gap-3">
        <Icon
            name="svg-spinners:ring-resize"
            :size="24"
            class="text-zinc-700 dark:text-zinc-300"
        />
        <span class="text-sm leading-none text-zinc-700 dark:text-zinc-300">
            画像処理中...
        </span>
    </div>
</template>
