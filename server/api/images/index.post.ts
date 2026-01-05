import { consola } from 'consola'
import { nanoid } from 'nanoid'
import sharp from 'sharp'
import { z } from 'zod'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // ファイルサイズ制限（10MB）
const MAX_DIMENSION = 1920 // 最大長辺（px）
const TARGET_MAX_FILE_SIZE = 2 * 1024 * 1024 // 圧縮後の目標最大ファイルサイズ（2MB）
const JPG_FILENAME_LENGTH = 16 // JPEGファイル名の長さ

const formData = z.object({
    blob: z
        .instanceof(Blob, { message: 'Blob is required' })
        .refine((blob) => blob.size <= MAX_FILE_SIZE, {
            message: `Blob size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        }),
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

const compressImage = async (buffer: Buffer) => {
    consola.start('Compressing image...')

    const metadata = await sharp(buffer).metadata()
    const { width = 0, height = 0 } = metadata

    // リサイズが必要かチェック
    const needsResize = width > MAX_DIMENSION || height > MAX_DIMENSION
    let resizedWidth: number | undefined
    let resizedHeight: number | undefined

    if (needsResize) {
        const aspectRatio = width / height
        if (width > height) {
            resizedWidth = MAX_DIMENSION
            resizedHeight = Math.round(MAX_DIMENSION / aspectRatio)
        } else {
            resizedHeight = MAX_DIMENSION
            resizedWidth = Math.round(MAX_DIMENSION * aspectRatio)
        }
        consola.info(`Resizing image from ${width}x${height} to ${resizedWidth}x${resizedHeight}`)
    }

    // 品質を段階的に下げて目標サイズに収める
    let quality = 90
    let compressedImage: Buffer

    do {
        let sharpInstance = sharp(buffer)

        if (needsResize) {
            sharpInstance = sharpInstance.resize(resizedWidth, resizedHeight, {
                fit: 'inside',
                withoutEnlargement: true,
            })
        }

        compressedImage = await sharpInstance.jpeg({ quality, progressive: true }).toBuffer()

        consola.info(
            `Compressed image with quality ${quality}: ${(
                compressedImage.length /
                1024 /
                1024
            ).toFixed(2)}MB`
        )

        if (compressedImage.length <= TARGET_MAX_FILE_SIZE || quality <= 30) break

        quality -= 10
    } while (quality > 0)

    const finalMetadata = await sharp(compressedImage).metadata()
    consola.success(
        `Image compressed successfully: ${finalMetadata.width}x${finalMetadata.height}, ${(
            compressedImage.length /
            1024 /
            1024
        ).toFixed(2)}MB`
    )

    return {
        buffer: compressedImage,
        width: finalMetadata.width || 0,
        height: finalMetadata.height || 0,
    }
}

export default defineApi(
    async () => {
        const { blob, path } = await validateFormData(formData)

        const config = useRuntimeConfig()

        consola.start('Processing and uploading image to Blob Storage...')

        const processedBuffer = Buffer.from(await blob.arrayBuffer())

        // 画像を圧縮
        const { buffer: compressedImage, width, height } = await compressImage(processedBuffer)

        const jpgFilename = `${nanoid(JPG_FILENAME_LENGTH)}.jpg`

        // パスの正規化
        const normalizedPath = path.replace(/\/+/g, '/').replace(/^\/|\/$/g, '')
        const fullPath = `${normalizedPath.split('/').join(':')}:${jpgFilename}`

        await useStorage('r2').setItemRaw(fullPath, compressedImage)

        consola.success('Image processed and uploaded successfully')
        return {
            url: `${config.public.r2.domain}/${normalizedPath}/${jpgFilename}`,
            width,
            height,
        }
    },
    {
        errorMessage: 'Failed to upload image',
        requireSession: true,
        rejectBannedUser: true,
    }
)
