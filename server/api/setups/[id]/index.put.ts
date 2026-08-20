import {
    setupCoauthors,
    setupImages,
    setupItems,
    setupItemShapekeys,
    setups,
    setupTags,
} from '@@/database/schema'
import { and, eq } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import { nanoid } from 'nanoid'
import { z } from 'zod'

const params = z.object({
    id: z.string(),
})

const body = setupsUpdateSchema

export default authedSessionEventHandler(
    async ({ event, session, db }) => {
        const { id } = await validateParams(params)

        // セットアップの存在確認と権限チェック
        const existingSetup = await db
            .select({ userId: setups.userId })
            .from(setups)
            .where(eq(setups.id, id))
            .limit(1)

        if (!existingSetup.length) throw serverError.notFound()
        if (existingSetup[0]?.userId !== session!.user.id) throw serverError.forbidden()

        const {
            public: isPublic,
            name,
            description,
            items,
            images,
            imageMetadata,
            tags,
            coauthors,
        } = await validateBody(body, { sanitize: true })

        // セットアップ基本情報の更新
        const updateData: Partial<
            Pick<typeof setups.$inferInsert, 'public' | 'name' | 'description' | 'updatedAt'>
        > = {}
        if (isPublic !== undefined) updateData.public = isPublic
        if (name !== undefined) updateData.name = name
        if (description !== undefined) updateData.description = description

        const hasRelationalChanges =
            items.length > 0 ||
            images !== undefined ||
            tags !== undefined ||
            coauthors !== undefined

        const imageData =
            images !== undefined
                ? await resolveSetupImageData(db, {
                      userId: session.user.id,
                      setupId: id,
                      images,
                      imageMetadata,
                  })
                : undefined

        const setupItemData = items.map((item) => ({
            id: nanoid(12),
            setupId: id,
            itemId: item.itemId,
            category: item.category,
            note: item.note,
            unsupported: item.category === 'avatar' ? false : item.unsupported,
        }))
        const shapekeys = items.flatMap((item, index) =>
            (item.shapekeys || []).map((shapekey) => ({
                setupItemId: setupItemData[index]!.id,
                name: shapekey.name,
                value: shapekey.value,
            })),
        )
        const queries: BatchItem<'sqlite'>[] = []

        if (Object.keys(updateData).length || hasRelationalChanges) {
            updateData.updatedAt = new Date()
            queries.push(
                db
                    .update(setups)
                    .set(updateData)
                    .where(and(eq(setups.id, id), eq(setups.userId, session.user.id)))
                    .returning({ id: setups.id }),
            )
        }

        queries.push(db.delete(setupItems).where(eq(setupItems.setupId, id)))
        if (setupItemData.length) queries.push(db.insert(setupItems).values(setupItemData))
        if (shapekeys.length) queries.push(db.insert(setupItemShapekeys).values(shapekeys))

        if (images !== undefined && imageData !== undefined) {
            queries.push(db.delete(setupImages).where(eq(setupImages.setupId, id)))
            if (imageData.length)
                queries.push(
                    db
                        .insert(setupImages)
                        .values(imageData.map((image) => ({ setupId: id, ...image }))),
                )
        }

        if (tags !== undefined) {
            queries.push(db.delete(setupTags).where(eq(setupTags.setupId, id)))
            if (tags.length)
                queries.push(
                    db.insert(setupTags).values(tags.map((tag) => ({ setupId: id, tag: tag.tag }))),
                )
        }

        if (coauthors !== undefined) {
            queries.push(db.delete(setupCoauthors).where(eq(setupCoauthors.setupId, id)))
            if (coauthors.length)
                queries.push(
                    db.insert(setupCoauthors).values(
                        coauthors.map((coauthor) => ({
                            setupId: id,
                            userId: coauthor.userId,
                            note: coauthor.note,
                        })),
                    ),
                )
        }

        const [updatedRows] = await executeD1Batch(db, queries)
        if (!(updatedRows as { id: string }[] | undefined)?.[0]) throw serverError.notFound()

        await purgeEdgeCacheTags(
            event,
            [getSetupCacheTag(id), EDGE_CACHE_TAGS.popularAvatars, EDGE_CACHE_TAGS.setups],
            'setup update',
        )

        const data = await useEvent().$fetch(`/api/setups/${id}`)

        return data
    },
    {
        rejectBannedUser: true,
    },
)
