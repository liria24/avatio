import { resolveLegalStatus, type LegalDocumentMetadata } from '@avatio/core/legal'
const current: LegalDocumentMetadata[] = ['terms', 'privacy-policy'].map((document) => ({
    document: document as LegalDocumentMetadata['document'],
    version: '2026-01-01',
    effectiveDate: '2026-01-01',
    sourceRevision: 'sha256:' + document,
    sourceCommit: 'server-commit',
    locale: 'ja',
}))

describe('independent legal acceptance', () => {
    it('decides by document/version, with independent updates, future activation and legacy fallback', () => {
        const now = new Date('2026-02-01T00:00:00Z')
        const accepted = current.map(({ document, version }) => ({ document, version }))
        expect(resolveLegalStatus(current, [], null, now).needsAgreement).toBe(true)
        expect(resolveLegalStatus(current, [], null, now).documents).toMatchObject([
            { document: 'terms', agreement: 'initial' },
            { document: 'privacy-policy', agreement: 'initial' },
        ])
        expect(resolveLegalStatus(current, accepted, null, now).needsAgreement).toBe(false)
        for (const changedDocument of ['terms', 'privacy-policy']) {
            const updated = current.map((document) =>
                document.document === changedDocument
                    ? { ...document, version: '2026-02-01', sourceRevision: 'correction' }
                    : document,
            )
            expect(
                resolveLegalStatus(updated, accepted, null, now)
                    .documents.filter((document) => !document.accepted)
                    .map((document) => document.document),
            ).toEqual([changedDocument])
        }
        expect(
            resolveLegalStatus(
                current.map((document) => ({ ...document, sourceRevision: 'correction' })),
                accepted,
                null,
                now,
            ).needsAgreement,
        ).toBe(false)
        expect(
            resolveLegalStatus(
                current.map((document) => ({ ...document, effectiveDate: '2026-03-01' })),
                [],
                null,
                now,
            ).needsAgreement,
        ).toBe(false)
        expect(
            resolveLegalStatus(current, [], new Date('2026-01-01T00:00:00Z'), now).documents.every(
                (document) => document.legacyAccepted,
            ),
        ).toBe(true)
        expect(
            resolveLegalStatus(current, [], new Date('2025-12-31T23:59:59Z'), now).needsAgreement,
        ).toBe(true)
        expect(
            resolveLegalStatus(current, [{ document: 'terms', version: '2025-01-01' }], null, now)
                .documents,
        ).toMatchObject([
            { document: 'terms', agreement: 'updated' },
            { document: 'privacy-policy', agreement: 'initial' },
        ])
        expect(
            resolveLegalStatus(current, [], new Date('2025-12-31T23:59:59Z'), now).documents,
        ).toMatchObject([{ agreement: 'updated' }, { agreement: 'updated' }])
    })
})
