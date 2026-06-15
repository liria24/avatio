import { nanoid } from 'nanoid'
import { z } from 'zod'

const log = logger('/api/images/complete:POST')

type ImageUploadPath = (typeof IMAGE_UPLOAD_PATHS)[number]
type ImageContentType = (typeof IMAGE_CONTENT_TYPES)[number]

type HeadMetadata = {
    type?: string | null
    contentType?: string | null
    size?: number | null
    etag?: string | null
}

const extensionByContentType: Record<ImageContentType, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
}

const body = z.object({
    objectKey: z.string().min(1),
    width: z.number().int().min(1).max(8192),
    height: z.number().int().min(1).max(8192),
})

const getTemporaryImagePath = (key: string, userId: string): ImageUploadPath | null =>
    IMAGE_UPLOAD_PATHS.find((path) => key.startsWith(`${path}/tmp/${userId}/`)) ?? null

const isImageContentType = (value: string): value is ImageContentType =>
    IMAGE_CONTENT_TYPES.includes(value as ImageContentType)

const createImageKey = (path: ImageUploadPath, userId: string, contentType: ImageContentType) =>
    `${path}/${userId}/${nanoid(IMAGE_KEY_ID_LENGTH)}.${extensionByContentType[contentType]}`

const readHeadMetadata = (head: HeadMetadata): HeadMetadata => ({
    type: head.type ?? null,
    contentType: head.contentType ?? null,
    size: head.size ?? null,
    etag: head.etag ?? null,
})

export default authedSessionEventHandler(
    async ({ session, db }) => {
        const { objectKey, width, height } = await validateBody(body)
        const path = getTemporaryImagePath(objectKey, session.user.id)
        if (!path) throw serverError.badRequest({ responseMessage: 'Invalid image key.' })

        await invalidateStorageCache(objectKey)
        const head = readHeadMetadata(await cachedStorageHead(objectKey))
        const contentType = head.type ?? head.contentType ?? ''

        if (!isImageContentType(contentType)) {
            await storage.delete(objectKey).catch(() => null)
            await invalidateStorageCache(objectKey)
            throw serverError.badRequest({ responseMessage: 'Unsupported image type.' })
        }

        if (!head.size || head.size > MAX_IMAGE_UPLOAD_SIZE) {
            await storage.delete(objectKey).catch(() => null)
            await invalidateStorageCache(objectKey)
            throw serverError.badRequest({ responseMessage: 'Image is too large.' })
        }

        const finalKey = createImageKey(path, session.user.id, contentType)
        await storage.move(objectKey, finalKey)
        await Promise.all([invalidateStorageCache(objectKey), invalidateStorageCache(finalKey)])

        const url = await cachedStorageUrl(finalKey)
        const { colors } = await extractImageColors(url)

        await createAuditLog(db, {
            userId: session.user.id,
            action: 'image_upload_complete',
            targetType: 'image',
            targetId: finalKey,
            details: JSON.stringify({ contentType, size: head.size, etag: head.etag }),
        })

        log.info('Completed image upload:', finalKey)

        return {
            objectKey: finalKey,
            url,
            width,
            height,
            themeColors: colors,
            contentType,
            size: head.size,
            etag: head.etag ?? null,
        }
    },
    {
        rejectBannedUser: true,
    },
)
