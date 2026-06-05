import { setupImages } from '@@/database/schema'
import type { SetupImageMetadata } from '@@/shared/types/database'
import { and, eq, inArray } from 'drizzle-orm'

interface ResolveSetupImageDataOptions {
    setupId?: string
    images?: string[]
    imageMetadata?: Record<string, SetupImageMetadata>
}

export const resolveSetupImageData = async (
    db: ReturnType<typeof useDB>,
    { setupId, images = [], imageMetadata }: ResolveSetupImageDataOptions,
) => {
    if (!images.length) return []

    const existingImages = setupId
        ? await db
              .select({
                  url: setupImages.url,
                  width: setupImages.width,
                  height: setupImages.height,
                  themeColors: setupImages.themeColors,
              })
              .from(setupImages)
              .where(and(eq(setupImages.setupId, setupId), inArray(setupImages.url, images)))
        : []
    const existingByUrl = new Map(existingImages.map((image) => [image.url, image]))

    return images.map((url) => {
        const metadata = imageMetadata?.[url]
        if (metadata)
            return {
                url,
                width: metadata.width,
                height: metadata.height,
                themeColors: metadata.themeColors?.length ? metadata.themeColors : null,
            }

        const existing = existingByUrl.get(url)
        if (existing) return existing

        throw serverError.badRequest({
            responseMessage: 'Image metadata is required for uploaded setup images.',
        })
    })
}
