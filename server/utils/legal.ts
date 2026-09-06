import {
    resolveLegalAcceptances,
    resolveLegalStatus,
    type LegalDocumentMetadata,
    type legalAcceptanceInputSchema,
} from '@avatio/core/legal'
import { eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import type { z } from 'zod'
import { legalAcceptances, users } from '~~/database/schema'

const log = logger('legalDocuments')

export const getCurrentLegalDocuments = async (
    event: H3Event,
    locale: string,
): Promise<LegalDocumentMetadata[]> => {
    try {
        return await (await getContentService(event)).getLegalDocuments(locale)
    } catch (error) {
        log.error('Legal metadata lookup failed', {
            locale,
            error: String(error),
            cause: error instanceof Error ? String(error.cause) : undefined,
        })
        throw createError({
            statusCode: 503,
            message: 'Legal documents are temporarily unavailable.',
        })
    }
}

export const getLegalStatus = async (
    db: AppDatabase,
    userId: string,
    current: LegalDocumentMetadata[],
) => {
    const [accepted, [user]] = await Promise.all([
        db
            .select({ document: legalAcceptances.document, version: legalAcceptances.version })
            .from(legalAcceptances)
            .where(eq(legalAcceptances.userId, userId)),
        db
            .select({ legacyAcceptedAt: users.lastAgreedToTerms })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1),
    ])
    return resolveLegalStatus(current, accepted, user?.legacyAcceptedAt ?? null)
}

export const acceptLegalDocuments = async (
    db: AppDatabase,
    userId: string,
    current: LegalDocumentMetadata[],
    requested: z.infer<typeof legalAcceptanceInputSchema>[],
) => {
    let records
    try {
        records = resolveLegalAcceptances(current, requested)
    } catch {
        throw createError({
            statusCode: 409,
            message: 'Legal documents changed. Review them again.',
        })
    }
    await executeD1Batch(
        db,
        records.map((record) =>
            db
                .insert(legalAcceptances)
                .values({ id: crypto.randomUUID(), userId, ...record })
                .onConflictDoNothing(),
        ),
    )
    return getLegalStatus(db, userId, current)
}
