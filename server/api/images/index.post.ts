import { nanoid } from 'nanoid'
import { withHttps } from 'ufo'
import { z } from 'zod'

const log = logger('/api/images:POST')

const MAX_FILE_SIZE = 2 * 1024 * 1024 // クライアント圧縮後の上限（2MB）
const JPG_FILENAME_LENGTH = 16 // JPEGファイル名の長さ

const formData = z.object({
    blob: z
        .instanceof(Blob, { message: 'Blob is required' })
        .refine((blob) => blob.type === 'image/jpeg', {
            message: 'Blob must be a JPEG image',
        })
        .refine((blob) => blob.size <= MAX_FILE_SIZE, {
            message: `Blob size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        }),
    path: z.enum(IMAGE_UPLOAD_PATHS),
    width: z.coerce.number().int().min(1).max(4096),
    height: z.coerce.number().int().min(1).max(4096),
    themeColors: z.preprocess(
        (value) => {
            if (Array.isArray(value)) return value
            if (typeof value === 'string') return value.split(',').filter(Boolean)
            return []
        },
        z
            .string()
            .regex(/^#[0-9a-f]{6}$/i)
            .array()
            .max(8),
    ),
})

export default authedSessionEventHandler(
    async ({ session }) => {
        const { blob, path, width, height, themeColors } = await validateFormData(formData)
        await enforceRateLimit({
            scope: 'images:create',
            identity: session.user.id,
            limit: 60,
            windowSeconds: 60,
        })

        log.start('Uploading image to R2...')

        const jpgFilename = `${nanoid(JPG_FILENAME_LENGTH)}.jpg`

        const objectKey = `${path}/${session.user.id}/${jpgFilename}`

        try {
            await storage.upload(objectKey, blob, { contentType: 'image/jpeg' })
        } catch {
            throw serverError.internalServerError()
        }

        log.success('Image processed and uploaded successfully:', objectKey)
        return {
            objectKey,
            url: withHttps(await storage.url(objectKey)),
            width,
            height,
            themeColors,
        }
    },
    {
        rejectBannedUser: true,
    },
)
