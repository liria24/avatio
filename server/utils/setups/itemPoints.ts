import type { SetupDraftContent } from '@avatio/core/setups'
import { and, eq, inArray, notInArray } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import { setupImagePoints, setupImages } from '~~/database/schema'

export const createSetupPointStatements = (
    db: AppDatabase,
    setupId: string,
    points: readonly SetupPoint[],
    entryIds: readonly string[],
    imageIds: readonly string[],
) => {
    if (new Set(points.map(({ id }) => id)).size !== points.length)
        throw serverError.badRequest({ responseMessage: 'Duplicate point ID.' })
    if (
        points.some(
            ({ entryId, imageId }) => !entryIds.includes(entryId) || !imageIds.includes(imageId),
        )
    )
        throw serverError.badRequest({
            responseMessage: 'Point references must belong to this setup.',
        })

    const queries: BatchItem<'sqlite'>[] = []
    // Six binds per point, with at most 100 binds per statement in D1.
    for (let offset = 0; offset < points.length; offset += 16)
        queries.push(
            db.insert(setupImagePoints).values(
                points.slice(offset, offset + 16).map(({ entryId, ...point }) => ({
                    ...point,
                    setupId,
                    setupEntryId: entryId,
                })),
            ),
        )
    return queries
}

export const updateSetupPointStatements = async (
    db: AppDatabase,
    setupId: string,
    points: readonly SetupPoint[] | undefined,
    entryIds: readonly string[],
    imageIds: string[] | undefined,
) => {
    const belongsToSetup = eq(setupImagePoints.setupId, setupId)
    if (points === undefined) {
        if (!imageIds) return []
        return [
            db
                .delete(setupImagePoints)
                .where(
                    imageIds.length
                        ? and(belongsToSetup, notInArray(setupImagePoints.imageId, imageIds))
                        : belongsToSetup,
                ),
        ]
    }

    const storedImages =
        imageIds ??
        (
            await db
                .select({ stableId: setupImages.stableId })
                .from(setupImages)
                .where(eq(setupImages.setupId, setupId))
        ).map(({ stableId }) => stableId)
    const inserts = createSetupPointStatements(db, setupId, points, entryIds, storedImages)
    for (let offset = 0; offset < points.length; offset += 100) {
        const claimedPoints = await db
            .select({ setupId: setupImagePoints.setupId })
            .from(setupImagePoints)
            .where(
                inArray(
                    setupImagePoints.id,
                    points.slice(offset, offset + 100).map(({ id }) => id),
                ),
            )
        if (claimedPoints.some((point) => point.setupId !== setupId))
            throw serverError.badRequest({ responseMessage: 'Point ID belongs to another setup.' })
    }
    return [db.delete(setupImagePoints).where(belongsToSetup), ...inserts]
}

export const projectSetupItemPoints = (
    points: Array<Omit<SetupPoint, 'entryId'> & { setupEntryId: string }>,
): SetupPoint[] => points.map(({ setupEntryId, ...point }) => ({ ...point, entryId: setupEntryId }))

export const retainDraftItemPoints = (
    content: Omit<SetupDraftContent, 'points'>,
    points: SetupPoint[],
) => {
    const entryIds = new Set(content.items.map(({ id }) => id))
    const imageIds = new Set(content.images.map((url) => content.imageMetadata?.[url]?.id))
    return points.filter(({ entryId, imageId }) => entryIds.has(entryId) && imageIds.has(imageId))
}
