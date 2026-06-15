import { PNG } from 'pngjs'

const log = logger('extractImageColors')
const MAX_SAMPLE_DIMENSION = 128

interface ExtractedImageColors {
    colors: string[]
    width: number
    height: number
}

const createCloudflareImageUrl = (url: string) => {
    const baseUrl = useRuntimeConfig().public.siteUrl
    return `${baseUrl}/cdn-cgi/image/fit=scale-down,width=${MAX_SAMPLE_DIMENSION},format=png,quality=100/${url}`
}

const hex = (value: number) => value.toString(16).padStart(2, '0')

const extractDominantColors = (data: Uint8Array) => {
    const buckets = new Map<string, { count: number; r: number; g: number; b: number }>()

    for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3] ?? 255
        if (alpha < 128) continue

        const r = data[i] ?? 0
        const g = data[i + 1] ?? 0
        const b = data[i + 2] ?? 0
        const saturation = Math.max(r, g, b) - Math.min(r, g, b)
        if (saturation < 18 && r > 235 && g > 235 && b > 235) continue
        if (r < 18 && g < 18 && b < 18) continue

        const key = `${r >> 4}-${g >> 4}-${b >> 4}`
        const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 }
        bucket.count += 1
        bucket.r += r
        bucket.g += g
        bucket.b += b
        buckets.set(key, bucket)
    }

    return [...buckets.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, 6)
        .map((bucket) => {
            const r = Math.round(bucket.r / bucket.count)
            const g = Math.round(bucket.g / bucket.count)
            const b = Math.round(bucket.b / bucket.count)
            return `#${hex(r)}${hex(g)}${hex(b)}`
        })
}

export const extractImageColors = async (imageUrl: string): Promise<ExtractedImageColors> => {
    try {
        const response = await fetch(createCloudflareImageUrl(imageUrl))
        if (!response.ok) return { colors: [], width: 0, height: 0 }

        const image = PNG.sync.read(Buffer.from(await response.arrayBuffer()))
        return {
            colors: extractDominantColors(image.data),
            width: image.width,
            height: image.height,
        }
    } catch (error) {
        log.warn('Failed to extract image colors:', error)
        return { colors: [], width: 0, height: 0 }
    }
}
