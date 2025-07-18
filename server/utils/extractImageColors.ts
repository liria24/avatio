import { extractColors } from 'extract-colors'
import getPixels from 'get-pixels'
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

    // 画像をフェッチして基本情報を取得
    const blob = await $fetch<Blob>(imageUrl)
    const buffer = Buffer.from(await blob.arrayBuffer())
    const metadata = await sharp(buffer).metadata()
    const { width = 0, height = 0 } = metadata

    // 色を抽出
    const colors = await new Promise<string[]>((resolve, reject) => {
        getPixels(imageUrl, async (err, px) => {
            if (err) {
                console.error('Error getting pixels:', err)
                reject(err)
                return
            }

            try {
                const data = [...px.data]
                const [width, height] = px.shape

                const extractedColors = await extractColors(
                    { data, width, height },
                    {
                        pixels,
                        distance,
                        saturationDistance,
                        lightnessDistance,
                        hueDistance,
                    }
                )

                resolve(
                    extractedColors
                        .sort((a, b) => b.area - a.area)
                        .map((color) => color.hex)
                )
            } catch (error) {
                console.error('Error extracting colors:', error)
                reject(error)
            }
        })
    })

    return {
        colors,
        width,
        height,
    }
}
