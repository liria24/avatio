import { consola } from 'consola'
import sharp from 'sharp'
import { createStorage } from 'unstorage'
import s3Driver from 'unstorage/drivers/s3'
import { z } from 'zod/v4'

// 許可される画像タイプ
const ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
] as const

type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number]

const MAX_FILE_SIZE = 10 * 1024 * 1024 // ファイルサイズ制限（10MB）

const formData = z.object({
    file: z
        .instanceof(File, { message: 'File is required' })
        .refine((file) => file.size <= MAX_FILE_SIZE, {
            message: `File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        })
        .refine(
            (file) => ALLOWED_MIME_TYPES.includes(file.type as AllowedMimeType),
            { message: 'File must be a valid image format' }
        ),
    path: z
        .string()
        .min(1, { message: 'Path is required' })
        .regex(/^[a-zA-Z0-9\-_/]+$/, {
            message: 'Path contains invalid characters',
        })
        .refine((path) => !path.includes('..'), {
            message: 'Path traversal is not allowed',
        }),
})

const generateJpgFilename = (randomLength: number = 6) => {
    const timestamp = Date.now().toString(36) // 36進数でタイムスタンプを短縮
    const random = Math.random()
        .toString(36)
        .substring(2, 2 + randomLength)

    return `${timestamp}${random}.jpg`
}

export default defineApi(
    async () => {
        const { file, path } = await validateFormData(formData)

        const config = useRuntimeConfig()

        const storage = createStorage({
            driver: s3Driver({
                accessKeyId: config.r2.accessKey,
                secretAccessKey: config.r2.secretKey,
                endpoint: config.r2.endpoint,
                bucket: 'avatio',
                region: 'auto',
            }),
        })

        consola.start('Processing and uploading image to Blob Storage...')

        const processedBuffer = Buffer.from(await file.arrayBuffer())
        const metadata = await sharp(processedBuffer).metadata()
        const image = await sharp(processedBuffer).jpeg().toBuffer()
        const jpgFilename = generateJpgFilename()

        // パスの正規化
        const normalizedPath = path.replace(/\/+/g, '/').replace(/^\/|\/$/g, '')
        const fullPath = `${normalizedPath.split('/').join(':')}:${jpgFilename}`

        await storage.setItemRaw(fullPath, image)

        consola.success('Image processed and uploaded successfully')
        return {
            url: `${config.public.r2.domain}/${normalizedPath}/${jpgFilename}`,
            width: metadata.width,
            height: metadata.height,
        }
    },
    {
        errorMessage: 'Failed to upload image',
        requireSession: true,
    }
)
