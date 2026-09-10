import { and, eq, inArray } from 'drizzle-orm'
import { setupImages } from '~~/database/schema'

interface ResolveSetupImageDataOptions {
    userId: string
    setupId?: string
    images?: string[]
    imageMetadata?: Record<string, SetupImageMetadata>
}

export const withSetupImageUrls = async <
    T extends {
        id?: string | number
        stableId?: string | null
        position?: number
        objectKey: string
    },
>(
    images: T[],
) => {
    const storage = useServerFiles()
    return await Promise.all(
        [...images]
            .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
            .map(async ({ id, stableId, position = 0, ...image }) => ({
                ...image,
                id: stableId ?? String(id ?? image.objectKey),
                position,
                url: await storage.url(image.objectKey),
            })),
    )
}

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
    if (new Set(objectKeys).size !== objectKeys.length)
        throw serverError.badRequest({ responseMessage: 'Duplicate setup image.' })

    const existingImages =
        setupId && objectKeys.length
            ? await db
                  .select({
                      id: setupImages.id,
                      stableId: setupImages.stableId,
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

    const resolvedImages = images.map((url, position) => {
        const metadata = imageMetadata?.[url]
        const objectKey = metadata?.objectKey ?? (url.includes('://') ? null : url)

        const existing = objectKey ? existingByObjectKey.get(objectKey) : undefined
        if (existing)
            return {
                ...existing,
                stableId: existing.stableId ?? metadata?.id ?? String(existing.id),
                position,
            }

        if (metadata) {
            if (!isUserSetupImageKey(metadata.objectKey, userId))
                throw serverError.badRequest({
                    responseMessage: 'Invalid image key.',
                })

            return {
                id: undefined,
                stableId: metadata.id ?? crypto.randomUUID(),
                position,
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

    const stableIds = resolvedImages.map(({ stableId }) => stableId)
    if (new Set(stableIds).size !== stableIds.length)
        throw serverError.badRequest({ responseMessage: 'Duplicate setup image ID.' })
    const claimedImages = await db
        .select({ stableId: setupImages.stableId, setupId: setupImages.setupId })
        .from(setupImages)
        .where(inArray(setupImages.stableId, stableIds))
    if (claimedImages.some(({ setupId: claimedSetupId }) => claimedSetupId !== setupId))
        throw serverError.badRequest({
            responseMessage: 'Setup image ID belongs to another setup.',
        })

    return resolvedImages
}
