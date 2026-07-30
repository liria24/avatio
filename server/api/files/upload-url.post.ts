import { nanoid } from 'nanoid'
import { z } from 'zod'

const log = logger('/api/files/upload-url:POST')
const SIGNED_UPLOAD_EXPIRES_IN = 60 * 5

type ImageUploadPath = (typeof IMAGE_UPLOAD_PATHS)[number]
type ImageContentType = (typeof IMAGE_CONTENT_TYPES)[number]

const extensionByContentType: Record<ImageContentType, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
}

const createTemporaryImageKey = (
    path: ImageUploadPath,
    userId: string,
    contentType: ImageContentType,
) => `${path}/tmp/${userId}/${nanoid(IMAGE_KEY_ID_LENGTH)}.${extensionByContentType[contentType]}`

const body = z.object({
    path: z.enum(IMAGE_UPLOAD_PATHS),
    filename: z.string().min(1).max(255),
    contentType: z.enum(IMAGE_CONTENT_TYPES),
    size: z.number().int().min(1).max(MAX_IMAGE_UPLOAD_SIZE),
})

export default authedSessionEventHandler(
    async ({ session, db }) => {
        const { path, contentType, size } = await validateBody(body)
        await enforceRateLimit({
            binding: 'RATE_LIMIT_IMAGE',
            key: `images:${session.user.id}`,
        })

        const objectKey = createTemporaryImageKey(path, session.user.id, contentType)

        const signed = await getStorage().signedUploadUrl(objectKey, {
            contentType,
            expiresIn: SIGNED_UPLOAD_EXPIRES_IN,
            maxSize: MAX_IMAGE_UPLOAD_SIZE,
            minSize: 1,
        })
        const uploadUrl =
            typeof signed === 'string'
                ? signed
                : 'uploadUrl' in signed
                  ? signed.uploadUrl
                  : signed.url

        await createAuditLog(db, {
            userId: session.user.id,
            action: 'image_upload_url_create',
            targetType: 'image',
            targetId: objectKey,
            details: JSON.stringify({ contentType, size }),
        })

        log.info('Created signed image upload URL:', objectKey)

        return {
            objectKey,
            uploadUrl,
            method: typeof signed === 'string' ? 'PUT' : signed.method,
            headers:
                typeof signed === 'string'
                    ? { 'content-type': contentType }
                    : 'headers' in signed
                      ? signed.headers
                      : undefined,
            fields:
                typeof signed === 'string' || signed.method === 'PUT' ? undefined : signed.fields,
            expiresAt: new Date(Date.now() + SIGNED_UPLOAD_EXPIRES_IN * 1000).toISOString(),
        }
    },
    {
        rejectBannedUser: true,
    },
)
