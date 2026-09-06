import { resolveLegalStatus, type LegalDocumentMetadata } from '@avatio/core/legal'
import { drizzle } from 'drizzle-orm/d1'
import { createError } from 'h3'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { relations } from '../../../database/relations'
import { executeD1Batch } from '../../../server/utils/executeD1Batch'
import {
    acceptLegalDocuments,
    getLegalStatus,
    getCurrentLegalDocuments,
} from '../../../server/utils/legal'
import { createTestD1 } from '../../helpers/d1'

const current: LegalDocumentMetadata[] = ['terms', 'privacy-policy'].map((document) => ({
    document: document as LegalDocumentMetadata['document'],
    version: '2026-01-01',
    effectiveDate: '2026-01-01',
    sourceRevision: `sha256:${document}`,
    sourceCommit: 'server-commit',
    locale: 'ja',
}))
afterEach(() => vi.unstubAllGlobals())
describe('independent legal acceptance', () => {
    it('decides by document/version, with independent updates, future activation and legacy fallback', () => {
        const now = new Date('2026-02-01T00:00:00Z')
        const accepted = current.map(({ document, version }) => ({ document, version }))
        expect(resolveLegalStatus(current, [], null, now).needsAgreement).toBe(true)
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
    })

    it('persists server identities once, rejects stale submissions, and never fabricates legacy records', async () => {
        const database = createTestD1()
        const db = drizzle(database.binding, { relations })
        vi.stubGlobal('executeD1Batch', executeD1Batch)
        vi.stubGlobal('createError', createError)
        try {
            database.sqlite.exec(
                "INSERT INTO users (id, name, username, display_username, email) VALUES ('user', 'User', 'user', 'User', 'user@example.com')",
            )
            expect((await getLegalStatus(db, 'user', current)).needsAgreement).toBe(false)
            expect(
                database.sqlite.prepare('SELECT count(*) AS count FROM legal_acceptances').get()
                    ?.count,
            ).toBe(0)
            await expect(
                acceptLegalDocuments(db, 'user', current, [
                    { document: 'terms', version: 'forged', sourceRevision: 'forged' },
                ]),
            ).rejects.toMatchObject({ statusCode: 409 })
            await acceptLegalDocuments(db, 'user', current, [current[0]!])
            await acceptLegalDocuments(
                db,
                'user',
                [{ ...current[0]!, sourceRevision: 'corrected' }, current[1]!],
                [{ ...current[0]!, sourceRevision: 'corrected' }],
            )
            const rows = database.sqlite
                .prepare(
                    'SELECT document, version, source_revision, source_commit, source_locale FROM legal_acceptances',
                )
                .all()
            expect(rows).toEqual([
                {
                    document: 'terms',
                    version: '2026-01-01',
                    source_revision: 'sha256:terms',
                    source_commit: 'server-commit',
                    source_locale: 'ja',
                },
            ])
            expect((await getLegalStatus(db, 'user', current)).documents[1]?.legacyAccepted).toBe(
                true,
            )
        } finally {
            database.sqlite.close()
        }
    })

    it('returns unavailable rather than treating source failure as accepted or no documents', async () => {
        vi.stubGlobal('getContentService', async () => {
            throw new Error('offline')
        })
        vi.stubGlobal('createError', createError)
        await expect(getCurrentLegalDocuments({} as never, 'ja')).rejects.toMatchObject({
            statusCode: 503,
        })
    })
})
