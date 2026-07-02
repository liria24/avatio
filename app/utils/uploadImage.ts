export interface UploadedImage {
    objectKey: string
    url: string
    width: number
    height: number
    themeColors: string[]
    contentType: string
    size: number
    etag: string | null
}

const MAX_UPLOAD_SIZE = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

const loadImageDimensions = async (file: File) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.decoding = 'async'

    try {
        await new Promise<void>((resolve, reject) => {
            image.onload = () => resolve()
            image.onerror = () => reject(new Error('Failed to load image.'))
            image.src = url
        })
        return { width: image.naturalWidth, height: image.naturalHeight }
    } finally {
        URL.revokeObjectURL(url)
    }
}

export const uploadImage = async (file: File, path: 'setup' | 'avatar'): Promise<UploadedImage> => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) throw new Error('Unsupported image type.')
    if (file.size > MAX_UPLOAD_SIZE) throw new Error('Image is too large.')

    const [{ width, height }, upload] = await Promise.all([
        loadImageDimensions(file),
        $fetch<{
            objectKey: string
            uploadUrl: string
            method: string
            headers?: Record<string, string>
            fields?: Record<string, string>
            expiresAt: string
        }>('/api/files/upload-url', {
            method: 'POST',
            body: {
                path,
                filename: file.name,
                contentType: file.type,
                size: file.size,
            },
        }),
    ])

    const body = upload.method === 'POST' && upload.fields ? new FormData() : file
    if (body instanceof FormData) {
        Object.entries(upload.fields || {}).forEach(([key, value]) => body.append(key, value))
        body.append('file', file)
    }

    const uploadResponse = await fetch(upload.uploadUrl, {
        method: upload.method,
        headers: upload.method === 'POST' ? undefined : upload.headers,
        body,
    })

    if (!uploadResponse.ok) throw new Error('Failed to upload image.')

    return await $fetch<UploadedImage>('/api/files/complete', {
        method: 'POST',
        body: {
            objectKey: upload.objectKey,
            width,
            height,
        },
    })
}
