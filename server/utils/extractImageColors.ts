import { extractColorsFromImageData } from 'extract-colors'
import { PNG } from 'pngjs/browser'

const log = logger('extractImageColors')
const MAX_COLORS = 6

interface ExtractedImageColors {
    colors: string[]
    width: number
    height: number
}

const extractImageColorsFromPng = (pngBytes: ArrayBuffer | Uint8Array): ExtractedImageColors => {
    const bytes = pngBytes instanceof ArrayBuffer ? new Uint8Array(pngBytes) : pngBytes
    const image = PNG.sync.read(Buffer.from(bytes))
    const colors = extractColorsFromImageData(
        {
            data: new Uint8ClampedArray(image.data),
            width: image.width,
            height: image.height,
        },
        {
            pixels: image.width * image.height,
            saturationDistance: 0.5,
            lightnessDistance: 0.65,
            hueDistance: 0.3,
            colorValidator: (red, green, blue, alpha) => {
                const saturation = Math.max(red, green, blue) - Math.min(red, green, blue)
                if (alpha < 128) return false
                if (saturation < 18 && red > 235 && green > 235 && blue > 235) return false
                if (red < 18 && green < 18 && blue < 18) return false
                return true
            },
        },
    )

    return {
        colors: colors
            .sort((a, b) => b.area - a.area)
            .slice(0, MAX_COLORS)
            .map((color) => color.hex),
        width: image.width,
        height: image.height,
    }
}

export const extractImageColors = async (
    image: ArrayBuffer | Uint8Array,
): Promise<ExtractedImageColors> => {
    try {
        return extractImageColorsFromPng(image)
    } catch (error) {
        log.warn('Failed to extract image colors:', error)
        return { colors: [], width: 0, height: 0 }
    }
}
