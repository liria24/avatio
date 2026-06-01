export interface UploadedImage {
    url: string
    width: number
    height: number
    themeColors: string[]
}

const MAX_UPLOAD_SIZE = 2 * 1024 * 1024
const MAX_IMAGE_DIMENSION = 1920
const COLOR_SAMPLE_SIZE = 96

const loadImage = async (file: File) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.decoding = 'async'

    try {
        await new Promise<void>((resolve, reject) => {
            image.onload = () => resolve()
            image.onerror = () => reject(new Error('Failed to load image.'))
            image.src = url
        })
        return { image, url }
    } catch (error) {
        URL.revokeObjectURL(url)
        throw error
    }
}

const calculateDimensions = (width: number, height: number) => {
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(width, height))
    return {
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale)),
    }
}

const canvasToBlob = async (canvas: HTMLCanvasElement, quality: number) =>
    await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (!blob) {
                    reject(new Error('Failed to encode image.'))
                    return
                }
                resolve(blob)
            },
            'image/jpeg',
            quality,
        )
    })

const hex = (value: number) => value.toString(16).padStart(2, '0')

const extractThemeColors = (image: HTMLImageElement): string[] => {
    const canvas = document.createElement('canvas')
    canvas.width = COLOR_SAMPLE_SIZE
    canvas.height = COLOR_SAMPLE_SIZE
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return []

    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)

    const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
    const buckets = new Map<string, { count: number; r: number; g: number; b: number }>()

    for (let i = 0; i < data.length; i += 16) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        if (r === undefined || g === undefined || b === undefined) continue

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

const prepareImage = async (file: File) => {
    const { image, url } = await loadImage(file)

    try {
        const { width, height } = calculateDimensions(image.naturalWidth, image.naturalHeight)
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext('2d')
        if (!context) throw new Error('Canvas is not available.')

        context.fillStyle = '#ffffff'
        context.fillRect(0, 0, width, height)
        context.drawImage(image, 0, 0, width, height)

        let quality = 0.9
        let blob = await canvasToBlob(canvas, quality)
        while (blob.size > MAX_UPLOAD_SIZE && quality > 0.3) {
            quality -= 0.1
            blob = await canvasToBlob(canvas, quality)
        }

        if (blob.size > MAX_UPLOAD_SIZE) throw new Error('Image is too large.')

        return {
            blob,
            width,
            height,
            themeColors: extractThemeColors(image),
        }
    } finally {
        URL.revokeObjectURL(url)
    }
}

export const uploadImage = async (file: File, path: string): Promise<UploadedImage> => {
    const image = await prepareImage(file)
    const formData = new FormData()
    formData.append('blob', image.blob)
    formData.append('path', path)
    formData.append('width', image.width.toString())
    formData.append('height', image.height.toString())
    formData.append('themeColors', image.themeColors.join(','))

    const response = await $fetch<UploadedImage>('/api/images', {
        method: 'POST',
        body: formData,
    })
    return response
}
