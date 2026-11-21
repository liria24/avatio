import { setupDraftImages, setupDrafts } from '@@/database/schema'
import { setupDraftContentSchema } from '@avatio/core/setups'
import { and, eq, exists, isNull, sql } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import { nanoid } from 'nanoid'
import { z } from 'zod'

const paramsSchema = z.object({ id: z.uuid() })
const bodySchema = z.object({
    targetSessionToken: z.string().min(1),
    expectedRevision: z.number().int().min(1),
})
const imageExtensionPattern = /\.(jpg|png|webp)$/i

export default authedSessionEventHandler(
    async ({ event, session, db }) => {
        const [{ id }, { targetSessionToken, expectedRevision }] = await Promise.all([
            validateParams(paramsSchema),
            validateBody(bodySchema, { sanitize: true }),
        ])
        await enforceRateLimit({ binding: 'RATE_LIMIT_DRAFT', key: `drafts:${session.user.id}` })

        const draft = await db.query.setupDrafts.findFirst({
            where: { id: { eq: id }, userId: { eq: session.user.id } },
            columns: { setupId: true, revision: true, content: true },
        })
        if (!draft) throw serverError.notFound()
        if (draft.setupId)
            throw serverError.badRequest({
                responseMessage: 'Drafts for existing setups cannot be transferred.',
            })
        if (draft.revision !== expectedRevision) throw serverError.conflict()

        const accountSwitch = await serverAuth(event).api.setActiveSession({
            headers: event.headers,
            body: { sessionToken: targetSessionToken },
            returnHeaders: true,
        })
        const target = accountSwitch.response
        if (target.user.id === session.user.id)
            throw serverError.badRequest({ responseMessage: 'Select a different account.' })
        if (target.user.banned) throw serverError.forbidden()

        const targetDrafts = await db.query.setupDrafts.findMany({
            where: { userId: { eq: target.user.id } },
            columns: { id: true },
            limit: MAX_SETUP_DRAFTS,
        })
        if (targetDrafts.length >= MAX_SETUP_DRAFTS)
            throw serverError.badRequest({
                responseMessage: 'The target account has reached the setup draft limit.',
            })

        const content = setupDraftContentSchema.parse(draft.content)
        const storage = useServerFiles()
        const movedImages = await Promise.all(
            content.images.map(async (sourceUrl) => {
                const metadata = content.imageMetadata?.[sourceUrl]
                if (!metadata || !isUserSetupImageKey(metadata.objectKey, session.user.id))
                    throw serverError.badRequest({ responseMessage: 'Invalid image key.' })
                const extension = metadata.objectKey
                    .match(imageExtensionPattern)?.[1]
                    ?.toLowerCase()
                if (!extension)
                    throw serverError.badRequest({ responseMessage: 'Invalid image key.' })

                const objectKey = `setup/${target.user.id}/${nanoid(16)}.${extension}`
                await storage.copy(metadata.objectKey, objectKey)
                return {
                    url: await storage.url(objectKey),
                    metadata: { ...metadata, objectKey },
                }
            }),
        )
        const movedContent = setupDraftContentSchema.parse({
            ...content,
            images: movedImages.map(({ url }) => url),
            imageMetadata: movedImages.length
                ? Object.fromEntries(movedImages.map(({ url, metadata }) => [url, metadata]))
                : undefined,
        })
        const revision = expectedRevision + 1
        const transferredDraft = and(
            eq(setupDrafts.id, id),
            eq(setupDrafts.userId, target.user.id),
            eq(setupDrafts.revision, revision),
            eq(setupDrafts.content, movedContent),
        )
        const queries: BatchItem<'sqlite'>[] = [
            db
                .update(setupDrafts)
                .set({
                    userId: target.user.id,
                    content: movedContent,
                    revision,
                    updatedAt: new Date(),
                })
                .where(
                    and(
                        eq(setupDrafts.id, id),
                        eq(setupDrafts.userId, session.user.id),
                        eq(setupDrafts.revision, expectedRevision),
                        isNull(setupDrafts.setupId),
                    ),
                )
                .returning({ id: setupDrafts.id }),
            db
                .delete(setupDraftImages)
                .where(
                    and(
                        eq(setupDraftImages.setupDraftId, id),
                        exists(
                            db
                                .select({ id: setupDrafts.id })
                                .from(setupDrafts)
                                .where(transferredDraft),
                        ),
                    ),
                ),
            ...movedImages.map(({ metadata }) =>
                db.insert(setupDraftImages).select(
                    db
                        .select({
                            id: sql<string>`${crypto.randomUUID()}`.as('id'),
                            setupDraftId: setupDrafts.id,
                            objectKey: sql<string>`${metadata.objectKey}`.as('object_key'),
                        })
                        .from(setupDrafts)
                        .where(transferredDraft),
                ),
            ),
        ]
        const [updated] = await executeAppBatch(db, queries)
        if (!(updated as { id: string }[] | undefined)?.[0]) throw serverError.conflict()

        for (const cookie of accountSwitch.headers.getSetCookie())
            appendResponseHeader(event, 'set-cookie', cookie)
        return { id, revision }
    },
    { rejectBannedUser: true },
)
