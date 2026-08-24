import {
    setupCoauthors,
    setupEntries,
    setupEntryShapekeys,
    setupImages,
    setupItems,
    setupItemShapekeys,
    setups,
    setupTags,
} from '@@/database/schema'
import { and, eq } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import type { H3Event } from 'h3'
import { nanoid } from 'nanoid'
import type { z } from 'zod'

import type { IdempotencyClaim } from './idempotency'

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

const buildEntryData = async (
    db: ReturnType<typeof useDB>,
    setupId: string,
    input: Pick<CreateSetupInput, 'items'>,
) => {
    const legacyEntries = input.items.map((item) => ({
        id: nanoid(12),
        setupId,
        itemId: item.itemId,
        category: item.category,
        note: item.note,
        unsupported: item.category === 'avatar' ? false : item.unsupported,
    }))
    const shapekeys = input.items.flatMap((item, index) =>
        (item.shapekeys || []).map((shapekey) => ({
            setupItemId: legacyEntries[index]!.id,
            ...shapekey,
        })),
    )
    return {
        legacyEntries,
        shapekeys,
        v2: await mapV2SetupEntryWrites(db, legacyEntries, shapekeys),
    }
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
    const entries = await buildEntryData(db, setupId, input)
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

    if (entries.legacyEntries.length)
        queries.push(db.insert(setupItems).values(entries.legacyEntries))
    if (entries.shapekeys.length)
        queries.push(db.insert(setupItemShapekeys).values(entries.shapekeys))
    if (entries.v2?.entries.length) queries.push(db.insert(setupEntries).values(entries.v2.entries))
    if (entries.v2?.shapekeys.length)
        queries.push(db.insert(setupEntryShapekeys).values(entries.v2.shapekeys))
    if (imageData.length)
        queries.push(
            db.insert(setupImages).values(imageData.map((image) => ({ ...image, setupId }))),
        )
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

    await executeD1Batch(db, queries)
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
        input.coauthors !== undefined
    const imageData =
        input.images === undefined
            ? undefined
            : await resolveSetupImageData(db, {
                  userId: user.id,
                  setupId: id,
                  images: input.images,
                  imageMetadata: input.imageMetadata,
              })
    const entries = await buildEntryData(db, id, input)
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
        db.delete(setupItems).where(eq(setupItems.setupId, id)),
        db.delete(setupEntries).where(eq(setupEntries.setupId, id)),
    )
    if (entries.legacyEntries.length)
        queries.push(db.insert(setupItems).values(entries.legacyEntries))
    if (entries.shapekeys.length)
        queries.push(db.insert(setupItemShapekeys).values(entries.shapekeys))
    if (entries.v2?.entries.length) queries.push(db.insert(setupEntries).values(entries.v2.entries))
    if (entries.v2?.shapekeys.length)
        queries.push(db.insert(setupEntryShapekeys).values(entries.v2.shapekeys))

    if (input.images !== undefined && imageData !== undefined) {
        queries.push(db.delete(setupImages).where(eq(setupImages.setupId, id)))
        if (imageData.length)
            queries.push(
                db
                    .insert(setupImages)
                    .values(imageData.map((image) => ({ setupId: id, ...image }))),
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

    const [updatedRows] = await executeD1Batch(db, queries)
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
