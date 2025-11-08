import { extractColors } from 'extract-colors'
import sharp from 'sharp'

interface ExtractImageColorsOptions {
    pixels?: number
    distance?: number
    saturationDistance?: number
    lightnessDistance?: number
    hueDistance?: number
}

export default async (
    imageUrl: string,
    options: ExtractImageColorsOptions = {}
) => {
    const {
        pixels = 64000,
        distance = 0.22,
        saturationDistance = 0.2,
        lightnessDistance = 0.2,
        hueDistance = 0.8,
    } = options

    // 画像をフェッチしてバッファに変換
    const blob = await $fetch<Blob>(imageUrl)
    const buffer = Buffer.from(await blob.arrayBuffer())

    // sharpを使用して画像データを取得
    const image = sharp(buffer)
    const metadata = await image.metadata()
    const { width = 0, height = 0 } = metadata

    // 画像を生のピクセルデータに変換
    const { data, info } = await image
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })

    // 色を抽出
    const extractedColors = await extractColors(
        {
            data: [...data],
            width: info.width,
            height: info.height,
        },
        {
            pixels,
            distance,
            saturationDistance,
            lightnessDistance,
            hueDistance,
        }
    )

    const colors = extractedColors
        .sort((a, b) => b.area - a.area)
        .map((color) => color.hex)

    return {
        colors,
        width,
        height,
    }
}
