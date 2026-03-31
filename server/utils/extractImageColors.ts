import { extractColors } from 'extract-colors'
import sharp from 'sharp'

interface ExtractImageColorsOptions {
    pixels?: number
    saturationDistance?: number
    lightnessDistance?: number
    hueDistance?: number
}

export default async (imageUrl: string, options: ExtractImageColorsOptions = {}) => {
    const {
        pixels = 40,
        saturationDistance = 0.5,
        lightnessDistance = 0.65,
        hueDistance = 0.3,
    } = options

    // 画像をフェッチしてバッファに変換
    const blob = await $fetch<Blob | null>(imageUrl, {
        responseType: 'blob',
        ignoreResponseError: true,
    })
    if (!blob) return { colors: [], width: 0, height: 0 }

    // sharpを使用して画像データを取得
    const image = sharp(Buffer.from(await blob.arrayBuffer()))
    const { width = 0, height = 0 } = await image.metadata()

    // 画像を生のピクセルデータに変換
    const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true })

    // 色を抽出
    const extractedColors = await extractColors(
        { data: [...data], width: info.width, height: info.height },
        { pixels, saturationDistance, lightnessDistance, hueDistance },
    )

    const colors = extractedColors.sort((a, b) => b.area - a.area).map((color) => color.hex)

    return {
        colors,
        width,
        height,
    }
}
