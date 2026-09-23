import { nanoid } from 'nanoid'
import { z } from 'zod'

const log = logger('/api/images:POST')
const MAX_FILE_SIZE = 5 * 1024 * 1024
const IMAGE_ID_LENGTH = 16

const formData = z.object({
    blob: z
        .instanceof(Blob, { message: 'Blob is required' })
        .refine((blob) => blob.size > 0 && blob.size <= MAX_FILE_SIZE, {
            message: 'Image must be between 1 byte and 5MB.',
        }),
    path: z.enum(IMAGE_UPLOAD_PATHS),
})

const extensionByContentType = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
} as const

const streamFromBytes = (bytes: ArrayBuffer) =>
    new Blob([new Uint8Array(bytes)]).stream() as ReadableStream<Uint8Array>

export default authedSessionEventHandler(
    async ({ event, session, db }) => {
        const { blob, path } = await validateFormData(formData)
        await enforceRateLimit({
            binding: 'RATE_LIMIT_IMAGE',
            key: `images:${session.user.id}`,
        })

        const bytes = await blob.arrayBuffer()
        const images = import.meta.dev ? undefined : getRuntimeEnv(event).IMAGES
        if (
            !import.meta.dev &&
            (!images || typeof images.info !== 'function' || typeof images.input !== 'function')
        )
            throw serverError.internalServerError({
                responseMessage: 'Cloudflare Images binding is not configured.',
            })
        let info: { contentType: string; width: number | undefined; height: number | undefined }
        let sampleBytes: ArrayBuffer | Uint8Array
        try {
            if (import.meta.dev) {
                const { processLocalUploadImage } =
                    await import('~~/server/utils/imageProcessing.local')
                const processed = await processLocalUploadImage(bytes)
                info = processed
                sampleBytes = processed.sample
            } else {
                const imageInfo = await images!.info(streamFromBytes(bytes))
                info = {
                    contentType: imageInfo.format,
                    width: imageInfo.width,
                    height: imageInfo.height,
                }
                const sample = await images!
                    .input(streamFromBytes(bytes))
                    .transform({ width: 96, height: 96, fit: 'scale-down' })
                    .output({ format: 'image/png' })
                sampleBytes = await new Response(sample.image()).arrayBuffer()
            }
        } catch {
            throw serverError.badRequest({ responseMessage: 'Invalid image data.' })
        }

        const contentType = info.contentType
        const { width, height } = info
        if (!(contentType in extensionByContentType))
            throw serverError.badRequest({ responseMessage: 'Unsupported image type.' })
        if (
            !Number.isInteger(width) ||
            !Number.isInteger(height) ||
            width === undefined ||
            height === undefined ||
            width < 1 ||
            height < 1 ||
            width > 8192 ||
            height > 8192
        )
            throw serverError.badRequest({ responseMessage: 'Image dimensions are invalid.' })

        const { colors } = await extractImageColors(sampleBytes)

        const objectKey = `${path}/${session.user.id}/${nanoid(IMAGE_ID_LENGTH)}.${extensionByContentType[contentType as keyof typeof extensionByContentType]}`
        const storage = useServerFiles()
        let uploaded: { etag?: string; size?: number }
        try {
            uploaded = await storage.upload(objectKey, blob, { contentType })
        } catch {
            throw serverError.internalServerError()
        }

        const url = await storage.url(objectKey)
        await createAuditLog(db, {
            userId: session.user.id,
            action: 'image_upload_complete',
            targetType: 'image',
            targetId: objectKey,
            details: JSON.stringify({ contentType, size: blob.size, etag: uploaded.etag }),
        })

        log.info('Image processed and uploaded successfully:', objectKey)
        return {
            objectKey,
            url,
            width,
            height,
            themeColors: colors,
            contentType,
            size: uploaded.size ?? blob.size,
            etag: uploaded.etag ?? null,
        }
    },
    { rejectBannedUser: true },
)
