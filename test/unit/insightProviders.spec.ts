import { drizzle } from 'drizzle-orm/d1'
import { createInsight } from 'insight-ts'

import { relations } from '../../database/relations'
import { useDB } from '../../server/utils/database'
import {
    applicationInsightProvider,
    cumulativeDailySeries,
} from '../../server/utils/insightProviders'
import { createTestD1 } from '../helpers/d1'

vi.mock('../../server/utils/database', () => ({ useDB: vi.fn() }))

describe('application insight series', () => {
    it('keeps the range-start baseline and fills cumulative UTC days', () => {
        const from = new Date('2026-08-01T00:00:00.000Z')
        const to = new Date('2026-08-03T12:00:00.000Z')

        expect(
            cumulativeDailySeries(
                10,
                [
                    { day: '2026-08-01', count: 2 },
                    { day: '2026-08-03', count: 3 },
                ],
                from,
                to,
            ),
        ).toEqual([
            { time: '2026-08-01T00:00:00.000Z', value: 10 },
            { time: '2026-08-01T23:59:59.999Z', value: 12 },
            { time: '2026-08-02T23:59:59.999Z', value: 12 },
            { time: '2026-08-03T11:59:59.999Z', value: 15 },
        ])
    })

    it('queries D1 application metrics through the alpha.1 canonical API and row-major results', async () => {
        const database = createTestD1()
        vi.mocked(useDB).mockReturnValue(drizzle(database.binding, { relations }))
        try {
            database.sqlite.exec(`
                INSERT INTO users (id, name, username, display_username, email, created_at)
                VALUES ('before', 'Before', 'before', 'Before', 'before@example.com', 1),
                       ('during', 'During', 'during', 'During', 'during@example.com', 1785628800000);
                INSERT INTO setups (id, user_id, name, created_at, hid_at)
                VALUES ('active-setup', 'before', 'Active', 1, NULL),
                       ('hidden-setup', 'before', 'Hidden', 1, 2);
            `)
            const insight = createInsight({ providers: [applicationInsightProvider] })
            const { application } = await insight.query((query) => ({
                application: query.metrics({
                    metrics: ['totalUsers', 'activeSetups'],
                    time: {
                        from: '2026-08-01T00:00:00.000Z',
                        to: '2026-08-03T00:00:00.000Z',
                        grain: 'day',
                    },
                }),
            }))
            expect(application.data.values).toEqual({ totalUsers: 2, activeSetups: 1 })
            expect(application.data.points?.at(-1)?.values).toEqual(application.data.values)
            expect(application.meta.temporal?.bucketTimezone).toBe('UTC')
        } finally {
            vi.mocked(useDB).mockReset()
            database.sqlite.close()
        }
    })
})
