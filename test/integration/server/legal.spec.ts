import type { LegalDocumentMetadata } from '@avatio/core/legal'
import { createError } from '@nuxt/nitro-server/h3'
import { drizzle } from 'drizzle-orm/d1'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { relations } from '../../../database/relations'
import { executeAppBatch } from '../../../server/utils/executeAppBatch'
import {
    acceptLegalDocuments,
    getLegalStatus,
    getCurrentLegalDocuments,
} from '../../../server/utils/legal'
import { createTestD1 } from '../../helpers/d1'

vi.hoisted(() => {
    vi.stubGlobal('logger', () => ({ error: vi.fn() }))
})

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
    it('persists server identities once, rejects stale submissions, and never fabricates legacy records', async () => {
        const database = createTestD1()
        const db = drizzle(database.binding, { relations })
        vi.stubGlobal('executeAppBatch', executeAppBatch)
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
