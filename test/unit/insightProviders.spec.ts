import { cumulativeDailySeries } from '../../server/utils/insightProviders'

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
})
