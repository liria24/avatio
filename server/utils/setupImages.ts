import { setupImages } from '@@/database/schema'
import type { SetupImageMetadata } from '@@/shared/types/database'
import { and, eq, inArray } from 'drizzle-orm'
import { withHttps } from 'ufo'

interface ResolveSetupImageDataOptions {
    userId: string
    setupId?: string
    images?: string[]
    imageMetadata?: Record<string, SetupImageMetadata>
}

export const withSetupImageUrls = async <T extends { objectKey: string }>(
    images: T[],
): Promise<(T & { url: string })[]> =>
    await Promise.all(
        images.map(async (image) => ({
            ...image,
            url: withHttps(await storage.url(image.objectKey)),
        })),
    )

export const isUserSetupImageKey = (objectKey: string, userId: string) =>
    objectKey.startsWith(`setup/${userId}/`)

export const resolveSetupImageData = async (
    db: ReturnType<typeof useDB>,
    { userId, setupId, images = [], imageMetadata }: ResolveSetupImageDataOptions,
) => {
    if (!images.length) return []

    const objectKeys = images
        .map((url) => imageMetadata?.[url]?.objectKey ?? (url.includes('://') ? null : url))
        .filter((objectKey): objectKey is string => Boolean(objectKey))

    const existingImages =
        setupId && objectKeys.length
            ? await db
                  .select({
                      objectKey: setupImages.objectKey,
                      width: setupImages.width,
                      height: setupImages.height,
                      themeColors: setupImages.themeColors,
                      contentType: setupImages.contentType,
                      size: setupImages.size,
                      etag: setupImages.etag,
                  })
                  .from(setupImages)
                  .where(
                      and(
                          eq(setupImages.setupId, setupId),
                          inArray(setupImages.objectKey, objectKeys),
                      ),
                  )
            : []
    const existingByObjectKey = new Map(existingImages.map((image) => [image.objectKey, image]))

    return images.map((url) => {
        const metadata = imageMetadata?.[url]
        const objectKey = metadata?.objectKey ?? (url.includes('://') ? null : url)

        const existing = objectKey ? existingByObjectKey.get(objectKey) : undefined
        if (existing) return existing

        if (metadata) {
            if (!isUserSetupImageKey(metadata.objectKey, userId))
                throw serverError.badRequest({
                    responseMessage: 'Invalid image key.',
                })

            return {
                objectKey: metadata.objectKey,
                width: metadata.width,
                height: metadata.height,
                themeColors: metadata.themeColors?.length ? metadata.themeColors : null,
                contentType: metadata.contentType ?? null,
                size: metadata.size ?? null,
                etag: metadata.etag ?? null,
            }
        }

        throw serverError.badRequest({
            responseMessage: 'Image metadata is required for uploaded setup images.',
        })
    })
}
