import type { H3Event } from '@nuxt/nitro-server/h3'
import { and, eq, inArray, notInArray } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import { nanoid } from 'nanoid'
import type { z } from 'zod'
import {
    catalogItems,
    setupCoauthors,
    setupEntries,
    setupEntryShapekeys,
    setupImagePoints,
    setupImages,
    setups,
    setupTags,
} from '~~/database/schema'

type CreateSetupInput = z.infer<typeof setupsInsertSchema>
type UpdateSetupInput = z.infer<typeof setupsUpdateSchema>

interface SetupCommandContext {
    event: H3Event
    db: ReturnType<typeof useDB>
    user: { id: string; role?: string | null }
}

const queryOwnerProjection = async (context: SetupCommandContext, id: string) => {
    const projection = await querySetupProjection(context.db, id, {
        userId: context.user.id,
        role: context.user.role,
    })
    if (!projection) throw serverError.internalServerError()
    return projection.setup
}

const prepareEntries = async (
    db: ReturnType<typeof useDB>,
    setupId: string,
    input: Pick<CreateSetupInput, 'items'>,
) => {
    const itemIds = [...new Set(input.items.map((item) => item.itemId))]
    if (itemIds.length !== input.items.length)
        throw serverError.badRequest({ responseMessage: 'Duplicate CatalogItem ID.' })
    const found = itemIds.length
        ? await db
              .select({ id: catalogItems.id })
              .from(catalogItems)
              .where(inArray(catalogItems.id, itemIds))
        : []
    if (found.length !== itemIds.length)
        throw serverError.badRequest({ responseMessage: 'Unknown CatalogItem ID.' })
    const entries = input.items.map((item, position) => ({
        id: item.id ?? nanoid(12),
        setupId,
        itemId: item.itemId,
        position,
        categoryOverride: item.category ?? null,
        note: item.note,
        unsupported: item.category === 'avatar' ? false : item.unsupported,
    }))
    const shapekeys = input.items.flatMap((item, index) =>
        (item.shapekeys ?? []).map((shapekey) => ({
            setupEntryId: entries[index]!.id,
            ...shapekey,
        })),
    )
    if (new Set(entries.map(({ id }) => id)).size !== entries.length)
        throw serverError.badRequest({ responseMessage: 'Duplicate SetupEntry ID.' })
    return { entries, shapekeys }
}

const preparePoints = (
    setupId: string,
    points: NonNullable<CreateSetupInput['points']>,
    entryIds: ReadonlySet<string>,
    imageIds: ReadonlySet<string>,
) => {
    if (new Set(points.map(({ id }) => id)).size !== points.length)
        throw serverError.badRequest({ responseMessage: 'Duplicate point ID.' })
    if (points.some(({ entryId, imageId }) => !entryIds.has(entryId) || !imageIds.has(imageId)))
        throw serverError.badRequest({
            responseMessage: 'Point references must belong to this setup.',
        })
    return points.map(({ entryId, ...point }) => ({
        ...point,
        setupId,
        setupEntryId: entryId,
    }))
}

export const createSetup = async (
    context: SetupCommandContext,
    input: CreateSetupInput,
    setupId: string,
    idempotency: IdempotencyClaim,
): Promise<Setup> => {
    const { event, db, user } = context
    const imageData = await resolveSetupImageData(db, {
        userId: user.id,
        images: input.images,
        imageMetadata: input.imageMetadata,
    })
    const { entries, shapekeys } = await prepareEntries(db, setupId, input)
    const points = preparePoints(
        setupId,
        input.points,
        new Set(entries.map(({ id }) => id)),
        new Set(imageData.map(({ stableId }) => stableId)),
    )
    const queries: BatchItem<'sqlite'>[] = [
        db.insert(setups).values({
            id: setupId,
            userId: user.id,
            public: input.public,
            name: input.name,
            description: input.description,
            idempotencyRequestId: idempotency.id,
        }),
    ]

    queries.push(db.insert(setupEntries).values(entries))
    if (shapekeys.length) queries.push(db.insert(setupEntryShapekeys).values(shapekeys))
    if (imageData.length)
        queries.push(
            db.insert(setupImages).values(imageData.map((image) => ({ ...image, setupId }))),
        )
    if (points.length) queries.push(db.insert(setupImagePoints).values(points))
    if (input.tags?.length)
        queries.push(
            db.insert(setupTags).values(input.tags.map((tag) => ({ setupId, tag: tag.tag }))),
        )
    if (input.coauthors?.length)
        queries.push(
            db
                .insert(setupCoauthors)
                .values(input.coauthors.map((coauthor) => ({ setupId, ...coauthor }))),
        )
    queries.push(completeIdempotencyRequest(db, idempotency, { id: setupId }))

    await executeAppBatch(db, queries)
    await invalidateCacheResources(
        event,
        { collections: [EDGE_CACHE_TAGS.popularAvatars, EDGE_CACHE_TAGS.setups] },
        'setup create',
    )
    return queryOwnerProjection(context, setupId)
}

export const updateSetup = async (
    context: SetupCommandContext,
    id: string,
    input: UpdateSetupInput,
): Promise<Setup> => {
    const { event, db, user } = context
    const [existing] = await db
        .select({ userId: setups.userId })
        .from(setups)
        .where(eq(setups.id, id))
        .limit(1)
    if (!existing) throw serverError.notFound()
    if (existing.userId !== user.id) throw serverError.forbidden()

    const updateData: Partial<
        Pick<typeof setups.$inferInsert, 'public' | 'name' | 'description' | 'updatedAt'>
    > = {}
    if (input.public !== undefined) updateData.public = input.public
    if (input.name !== undefined) updateData.name = input.name
    if (input.description !== undefined) updateData.description = input.description

    const hasRelationalChanges =
        input.items.length > 0 ||
        input.images !== undefined ||
        input.tags !== undefined ||
        input.coauthors !== undefined ||
        input.points !== undefined
    const imageData =
        input.images === undefined
            ? undefined
            : await resolveSetupImageData(db, {
                  userId: user.id,
                  setupId: id,
                  images: input.images,
                  imageMetadata: input.imageMetadata,
              })
    const { entries, shapekeys } = await prepareEntries(db, id, input)
    const entryIds = entries.map(({ id: entryId }) => entryId)
    const claimedEntries = await db
        .select({ id: setupEntries.id, setupId: setupEntries.setupId })
        .from(setupEntries)
        .where(inArray(setupEntries.id, entryIds))
    if (claimedEntries.some(({ setupId }) => setupId !== id))
        throw serverError.badRequest({ responseMessage: 'SetupEntry ID belongs to another setup.' })
    const existingPointImages =
        input.points !== undefined && imageData === undefined
            ? await db
                  .select({
                      id: setupImages.id,
                      stableId: setupImages.stableId,
                  })
                  .from(setupImages)
                  .where(eq(setupImages.setupId, id))
            : []
    const imageIds = new Set([
        ...(imageData ?? []).map(({ stableId }) => stableId),
        ...existingPointImages.map(({ id: imageId, stableId }) => stableId ?? String(imageId)),
    ])
    const points = input.points
        ? preparePoints(id, input.points, new Set(entryIds), imageIds)
        : undefined
    const pointIds = points?.map(({ id: pointId }) => pointId) ?? []
    const claimedPoints = pointIds.length
        ? await db
              .select({ id: setupImagePoints.id, setupId: setupImagePoints.setupId })
              .from(setupImagePoints)
              .where(inArray(setupImagePoints.id, pointIds))
        : []
    if (claimedPoints.some(({ setupId }) => setupId !== id))
        throw serverError.badRequest({ responseMessage: 'Point ID belongs to another setup.' })
    const queries: BatchItem<'sqlite'>[] = []

    if (Object.keys(updateData).length || hasRelationalChanges) {
        updateData.updatedAt = new Date()
        queries.push(
            db
                .update(setups)
                .set(updateData)
                .where(and(eq(setups.id, id), eq(setups.userId, user.id)))
                .returning({ id: setups.id }),
        )
    }

    queries.push(
        db
            .delete(setupEntries)
            .where(and(eq(setupEntries.setupId, id), notInArray(setupEntries.id, entryIds))),
    )
    const existingEntryIds = new Set(claimedEntries.map(({ id: entryId }) => entryId))
    for (const entry of entries)
        if (existingEntryIds.has(entry.id))
            queries.push(
                db
                    .update(setupEntries)
                    .set(entry)
                    .where(and(eq(setupEntries.id, entry.id), eq(setupEntries.setupId, id))),
            )
    const newEntries = entries.filter(({ id: entryId }) => !existingEntryIds.has(entryId))
    if (newEntries.length) queries.push(db.insert(setupEntries).values(newEntries))
    queries.push(
        db.delete(setupEntryShapekeys).where(inArray(setupEntryShapekeys.setupEntryId, entryIds)),
    )
    if (shapekeys.length) queries.push(db.insert(setupEntryShapekeys).values(shapekeys))

    if (input.images !== undefined && imageData !== undefined) {
        const retainedImageIds = imageData.flatMap((image) => (image.id ? [image.id] : []))
        queries.push(
            retainedImageIds.length
                ? db
                      .delete(setupImages)
                      .where(
                          and(
                              eq(setupImages.setupId, id),
                              notInArray(setupImages.id, retainedImageIds),
                          ),
                      )
                : db.delete(setupImages).where(eq(setupImages.setupId, id)),
        )
        for (const image of imageData)
            if (image.id)
                queries.push(
                    db
                        .update(setupImages)
                        .set({ stableId: image.stableId, position: image.position })
                        .where(and(eq(setupImages.id, image.id), eq(setupImages.setupId, id))),
                )
        const newImages = imageData.filter((image) => !image.id)
        if (newImages.length)
            queries.push(
                db
                    .insert(setupImages)
                    .values(newImages.map((image) => ({ setupId: id, ...image }))),
            )
    }
    if (points) {
        queries.push(
            pointIds.length
                ? db
                      .delete(setupImagePoints)
                      .where(
                          and(
                              eq(setupImagePoints.setupId, id),
                              notInArray(setupImagePoints.id, pointIds),
                          ),
                      )
                : db.delete(setupImagePoints).where(eq(setupImagePoints.setupId, id)),
        )
        const existingPointIds = new Set(claimedPoints.map(({ id: pointId }) => pointId))
        for (const point of points)
            if (existingPointIds.has(point.id))
                queries.push(
                    db
                        .update(setupImagePoints)
                        .set(point)
                        .where(
                            and(
                                eq(setupImagePoints.id, point.id),
                                eq(setupImagePoints.setupId, id),
                            ),
                        ),
                )
        const newPoints = points.filter(({ id: pointId }) => !existingPointIds.has(pointId))
        if (newPoints.length) queries.push(db.insert(setupImagePoints).values(newPoints))
    } else if (imageData) {
        const retainedImageIds = imageData.map(({ stableId }) => stableId)
        queries.push(
            retainedImageIds.length
                ? db
                      .delete(setupImagePoints)
                      .where(
                          and(
                              eq(setupImagePoints.setupId, id),
                              notInArray(setupImagePoints.imageId, retainedImageIds),
                          ),
                      )
                : db.delete(setupImagePoints).where(eq(setupImagePoints.setupId, id)),
        )
    }
    if (input.tags !== undefined) {
        queries.push(db.delete(setupTags).where(eq(setupTags.setupId, id)))
        if (input.tags.length)
            queries.push(
                db
                    .insert(setupTags)
                    .values(input.tags.map((tag) => ({ setupId: id, tag: tag.tag }))),
            )
    }
    if (input.coauthors !== undefined) {
        queries.push(db.delete(setupCoauthors).where(eq(setupCoauthors.setupId, id)))
        if (input.coauthors.length)
            queries.push(
                db.insert(setupCoauthors).values(
                    input.coauthors.map((coauthor) => ({
                        setupId: id,
                        userId: coauthor.userId,
                        note: coauthor.note,
                    })),
                ),
            )
    }

    const [updatedRows] = await executeAppBatch(db, queries)
    if (!(updatedRows as { id: string }[] | undefined)?.[0]) throw serverError.notFound()

    await invalidateCacheResources(
        event,
        {
            setups: [id],
            collections: [EDGE_CACHE_TAGS.popularAvatars, EDGE_CACHE_TAGS.setups],
        },
        'setup update',
    )
    return queryOwnerProjection(context, id)
}
