import { z } from 'zod'

export const legalDocuments = ['terms', 'privacy-policy'] as const
export type LegalDocument = (typeof legalDocuments)[number]

export const legalVersionSchema = z.object({
    version: z.string().min(1),
    effectiveDate: z.iso.date(),
})

export interface LegalDocumentMetadata extends z.infer<typeof legalVersionSchema> {
    document: LegalDocument
    sourceRevision: string
    sourceCommit?: string
    locale: string
}

export interface LegalDocumentStatus extends LegalDocumentMetadata {
    active: boolean
    accepted: boolean
    legacyAccepted: boolean
    agreement: 'initial' | 'updated' | null
}

export interface LegalStatus {
    needsAgreement: boolean
    documents: LegalDocumentStatus[]
}

export const resolveLegalStatus = (
    documents: readonly LegalDocumentMetadata[],
    acceptances: readonly { document: LegalDocument; version: string }[],
    legacyAcceptedAt: Date | null,
    now = new Date(),
): LegalStatus => {
    const statuses = documents.map((document): LegalDocumentStatus => {
        const recorded = acceptances.filter(
            (acceptance) => acceptance.document === document.document,
        )
        const accepted = recorded.some((acceptance) => acceptance.version === document.version)
        const effectiveAt = new Date(`${document.effectiveDate}T00:00:00.000Z`)
        const legacyAccepted =
            !accepted && Boolean(legacyAcceptedAt && legacyAcceptedAt >= effectiveAt)
        return {
            ...document,
            active: now >= effectiveAt,
            accepted: accepted || legacyAccepted,
            legacyAccepted,
            agreement:
                now < effectiveAt || accepted || legacyAccepted
                    ? null
                    : recorded.length || legacyAcceptedAt
                      ? 'updated'
                      : 'initial',
        }
    })
    return {
        needsAgreement: statuses.some((status) => status.active && !status.accepted),
        documents: statuses,
    }
}

export const legalAcceptanceInputSchema = z.object({
    document: z.enum(legalDocuments),
    version: z.string().min(1),
    sourceRevision: z.string().min(1),
})

/** Client identities are preconditions only; persisted identities come from the content source. */
export const resolveLegalAcceptances = (
    current: readonly LegalDocumentMetadata[],
    requested: readonly z.infer<typeof legalAcceptanceInputSchema>[],
    now = new Date(),
) =>
    requested.map((input) => {
        const document = current.find((candidate) => candidate.document === input.document)
        if (
            !document ||
            document.version !== input.version ||
            document.sourceRevision !== input.sourceRevision ||
            new Date(`${document.effectiveDate}T00:00:00.000Z`) > now
        )
            throw new Error('Legal document changed or is not yet effective. Review it again.')
        return {
            document: document.document,
            version: document.version,
            sourceRevision: document.sourceRevision,
            sourceCommit: document.sourceCommit ?? null,
            sourceLocale: document.locale,
            acceptedAt: now,
        }
    })
