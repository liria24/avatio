interface CompressImageMessage {
    type: 'compress'
    imageData: string
    resolution: number
    maxSize: number
}

// リサイズ計算
function calcResize(width: number, height: number, resolution: number) {
    if (Math.max(width, height) <= resolution) return { width, height }

    const ratio = width / height
    return width > height
        ? { width: resolution, height: Math.round(resolution / ratio) }
        : { height: resolution, width: Math.round(resolution * ratio) }
}

// 最適な圧縮品質を探す
async function optimizeCompression(
    compress: (quality: number) => Promise<Blob>,
    maxSize: number,
    onProgress?: (i: number) => void
) {
    let min = 20,
        max = 90
    let bestQuality = min
    let bestBlob = null

    // 高品質で試行
    let blob = await compress(max)
    if (blob.size <= maxSize) return { bestQuality: max, bestBlob: blob }

    // 二分探索で最適な品質を探す
    for (let i = 0; i < 5; i++) {
        if (onProgress) onProgress(i)

        const quality = Math.floor((min + max) / 2)
        blob = await compress(quality)

        if (blob.size <= maxSize) {
            bestBlob = blob
            bestQuality = quality
            min = quality
        } else {
            max = quality - 1
        }

        if (max - min <= 2) break
    }

    // 適切な品質が見つからなかった場合
    if (!bestBlob) {
        bestQuality = min
        bestBlob = await compress(min)
    }

    return { bestQuality, bestBlob }
}

self.onmessage = async (e: MessageEvent<CompressImageMessage>) => {
    if (e.data.type !== 'compress') return

    const { imageData, resolution, maxSize = 1.5 * 1024 * 1024 } = e.data

    try {
        // 進捗通知
        const progress = (stage: string, percent: number) =>
            postMessage({ type: 'progress', stage, percent })

        progress('画像読み込み中', 10)

        // 画像読み込み
        const blob = await (await fetch(imageData)).blob()
        const img = await createImageBitmap(blob)

        progress('リサイズ処理中', 30)

        // リサイズ計算
        const { width, height } = calcResize(img.width, img.height, resolution)

        // Canvas処理
        const canvas = new OffscreenCanvas(width, height)
        const ctx = canvas.getContext('2d', {
            alpha: false,
            desynchronized: true,
            willReadFrequently: false,
        })

        if (!ctx) throw new Error('Canvas contextの取得に失敗しました')

        // 高品質リサイズ
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, 0, 0, width, height)

        progress('画像圧縮中', 60)

        // 圧縮処理
        const result = await optimizeCompression(
            (quality) =>
                canvas.convertToBlob({
                    type: 'image/jpeg',
                    quality: quality / 100,
                }),
            maxSize,
            (i) => progress(`圧縮最適化中 (${i + 1}/5)`, 60 + i * 8)
        )

        progress('完了', 100)

        // 結果送信
        const buffer = await result.bestBlob!.arrayBuffer()
        postMessage(
            {
                type: 'result',
                quality: result.bestQuality,
                size: result.bestBlob!.size,
                data: buffer,
                width,
                height,
            },
            { transfer: [buffer] }
        )
    } catch (error) {
        postMessage({
            type: 'error',
            message: error instanceof Error ? error.message : String(error),
        })
    }
}
