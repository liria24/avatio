import { createError, type H3Event } from '@nuxt/nitro-server/h3'
import { drizzle } from 'drizzle-orm/d1'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { relations } from '../../../database/relations'
import type { AppDatabase } from '../../../server/utils/database'
import { executeAppBatch } from '../../../server/utils/executeAppBatch'
import {
    claimIdempotencyRequest,
    completeIdempotencyRequest,
} from '../../../server/utils/idempotency'
import sanitizeObject from '../../../server/utils/sanitizeObject'
import { createTestD1 } from '../../helpers/d1'

let database: ReturnType<typeof createTestD1>
let db: AppDatabase
const translate = vi.fn()

beforeEach(() => {
    database = createTestD1()
    db = drizzle(database.binding, { relations })
    translate.mockReset()
    Object.entries({
        createError,
        logger: () => ({ error: vi.fn() }),
        promiseEventHandler: (handler: unknown) => handler,
        requireUserSession: async () => ({ user: { id: 'admin' } }),
        validateBody: async () => ({ slug: 'release', title: '更新', markdown: '**内容**' }),
        getHeader: () => '4ecb4ccc-216c-4a66-b538-0a83f55fb9cc',
        useAiCapabilities: () => ({ changelogTranslator: { translate } }),
        claimIdempotencyRequest,
        completeIdempotencyRequest,
        executeAppBatch,
        sanitizeObject,
        invalidateCacheResources: vi.fn(),
        EDGE_CACHE_TAGS: { changelogs: 'changelogs' },
    }).forEach(([key, value]) => vi.stubGlobal(key, value))
})
afterEach(() => {
    database.sqlite.close()
    vi.unstubAllGlobals()
    vi.resetModules()
})

const createChangelog = async (db: AppDatabase) => {
    const handler = (await import('../../../server/api/admin/changelogs/index.post'))
        .default as unknown as (context: { db: AppDatabase; event: H3Event }) => Promise<unknown>
    return handler({ db, event: {} as H3Event })
}

describe('changelog translation persistence', () => {
    it('sanitizes semantic translation output at the POST storage boundary', async () => {
        translate.mockResolvedValue({
            title: '<script>alert(1)</script>Safe title',
            content: '**Safe**<script>alert(1)</script>',
        })
        await expect(createChangelog(db)).resolves.toEqual({ slug: 'release' })
        expect(translate).toHaveBeenCalledWith({
            title: '更新',
            content: '**内容**',
            sourceLocale: 'Japanese',
            targetLocale: 'English',
        })
        expect(
            database.sqlite
                .prepare(
                    'SELECT changelog_slug, locale, title, markdown, ai_generated FROM changelog_i18ns',
                )
                .all(),
        ).toEqual([
            {
                changelog_slug: 'release',
                locale: 'en',
                title: 'Safe title',
                markdown: '**Safe**',
                ai_generated: 1,
            },
        ])
        expect(database.sqlite.prepare('SELECT status FROM idempotency_requests').get()).toEqual({
            status: 'completed',
        })
    })

    it('leaves no changelog rows when translation fails', async () => {
        translate.mockRejectedValue(new Error('Invalid translation output'))
        await expect(createChangelog(db)).rejects.toMatchObject({ statusCode: 500 })
        expect(database.sqlite.prepare('SELECT * FROM changelogs').all()).toEqual([])
        expect(database.sqlite.prepare('SELECT * FROM changelog_i18ns').all()).toEqual([])
    })
})
