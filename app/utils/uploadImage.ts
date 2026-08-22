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

export const uploadImage = async (file: File, path: 'setup' | 'avatar'): Promise<UploadedImage> => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) throw new Error('Unsupported image type.')
    if (file.size > MAX_UPLOAD_SIZE) throw new Error('Image is too large.')

    const body = new FormData()
    body.append('blob', file)
    body.append('path', path)

    return await $fetch<UploadedImage>('/api/images', {
        method: 'POST',
        body,
    })
}
