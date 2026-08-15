import {
    setupCoauthors,
    setupImages,
    setupItems,
    setupItemShapekeys,
    setups,
    setupTags,
} from '@@/database/schema'
import type { BatchItem } from 'drizzle-orm/batch'
import { nanoid } from 'nanoid'

const body = setupsInsertSchema

export default authedSessionEventHandler(
    async ({ event, session, db }) => {
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

        await enforceRateLimit({
            binding: 'RATE_LIMIT_USER_ACTION',
            key: `setups:${session.user.id}`,
        })

        const requestBody = {
            public: isPublic,
            name,
            description,
            items,
            images,
            imageMetadata,
            tags,
            coauthors,
        }
        const generatedSetupId = nanoid(8)
        const idempotency = await claimIdempotencyRequest({
            event,
            db,
            scope: `user:${session.user.id}`,
            route: '/api/setups',
            body: requestBody,
            resourceId: generatedSetupId,
        })
        if (idempotency.replay) {
            if (!idempotency.resourceId) throw serverError.internalServerError()
            return await event.$fetch<Setup>(`/api/setups/${idempotency.resourceId}`)
        }

        const imageData = await resolveSetupImageData(db, {
            userId: session.user.id,
            images,
            imageMetadata,
        })

        const setupId = idempotency.resourceId ?? generatedSetupId
        const setupItemData = items.map((item) => ({
            id: nanoid(12),
            setupId,
            itemId: item.itemId,
            category: item.category,
            note: item.note,
            unsupported: item.category === 'avatar' ? false : item.unsupported,
        }))
        const shapekeys = items.flatMap((item, index) =>
            (item.shapekeys || []).map((shapekey) => ({
                setupItemId: setupItemData[index]!.id,
                ...shapekey,
            })),
        )
        const queries: BatchItem<'sqlite'>[] = [
            db.insert(setups).values({
                id: setupId,
                userId: session.user.id,
                public: isPublic,
                name,
                description,
                idempotencyRequestId: idempotency.id,
            }),
        ]

        if (setupItemData.length) queries.push(db.insert(setupItems).values(setupItemData))
        if (shapekeys.length) queries.push(db.insert(setupItemShapekeys).values(shapekeys))
        if (imageData.length)
            queries.push(
                db.insert(setupImages).values(imageData.map((img) => ({ ...img, setupId }))),
            )
        if (tags?.length)
            queries.push(
                db.insert(setupTags).values(tags.map((tag) => ({ setupId, tag: tag.tag }))),
            )
        if (coauthors?.length)
            queries.push(
                db
                    .insert(setupCoauthors)
                    .values(coauthors.map((coauthor) => ({ setupId, ...coauthor }))),
            )

        queries.push(completeIdempotencyRequest(db, idempotency, { id: setupId }))

        await executeD1Batch(db, queries)

        await purgeEdgeCacheTags(
            event,
            [EDGE_CACHE_TAGS.popularAvatars, EDGE_CACHE_TAGS.setups],
            'setup create',
        )

        const data = await event.$fetch(`/api/setups/${setupId}`)

        return data
    },
    {
        rejectBannedUser: true,
    },
)
