import { z } from 'zod'

const log = logger('/api/admin/insights:GET')
const querySchema = z.object({
    days: z.enum(['7', '30', '90']).default('30').transform(Number),
})

const loadSection = async <T>(name: string, configured: boolean, load: () => Promise<T>) => {
    if (!configured) return { status: 'unconfigured' as const }
    try {
        return { status: 'ok' as const, data: await load() }
    } catch (error) {
        log.error(`Failed to load ${name} insights:`, error)
        return { status: 'error' as const }
    }
}

export default promiseEventHandler(async ({ event }) => {
    await requireUserSession(event, { user: { role: 'admin' } })
    applyNoStoreCache(event)

    const { days } = await validateQuery(querySchema)
    const to = new Date()
    const from = new Date(
        Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate() - days + 1),
    )
    const time = { from: from.toISOString(), to: to.toISOString() }
    const cloudflareConfigured = configureCloudflareInsight(event)
    const searchConfigured = isGoogleSearchConsoleConfigured(event)
    const insight = useInsight()

    const [application, traffic, search] = await Promise.all([
        loadSection('application', true, async () => {
            const result = await insight.query((query) => ({
                application: query.metrics({
                    metrics: ['totalUsers', 'activeSetups'],
                    time: { ...time, grain: 'day' },
                }),
            }))
            return result.application
        }),
        loadSection('Cloudflare Web Analytics', cloudflareConfigured, () =>
            insight.query((query) => ({
                totals: query.metrics({
                    metrics: ['pageViews', 'visits'],
                    time,
                }),
                series: query.metrics({
                    metrics: ['pageViews', 'visits'],
                    time: { ...time, grain: 'day' },
                }),
                pages: query.metrics({
                    metrics: ['pageViews'],
                    dimensions: ['path'],
                    limit: 10,
                    time,
                }),
                countries: query.metrics({
                    metrics: ['pageViews'],
                    dimensions: ['country'],
                    limit: 10,
                    time,
                }),
                devices: query.metrics({
                    metrics: ['pageViews'],
                    dimensions: ['device'],
                    limit: 10,
                    time,
                }),
                referrers: query.metrics({
                    metrics: ['pageViews'],
                    dimensions: ['referer'],
                    limit: 10,
                    time,
                }),
            })),
        ),
        loadSection('Google Search Console', searchConfigured, async () => {
            await getGoogleSearchConsoleAccessToken()
            return insight.query((query) => ({
                totals: query.metrics({
                    metrics: ['clicks', 'impressions', 'ctr', 'averagePosition'],
                    time,
                }),
                series: query.metrics({
                    metrics: ['clicks', 'impressions', 'ctr', 'averagePosition'],
                    time: { ...time, grain: 'day' },
                }),
                queries: query.metrics({
                    metrics: ['clicks', 'impressions'],
                    dimensions: ['query'],
                    limit: 10,
                    time,
                }),
                pages: query.metrics({
                    metrics: ['clicks', 'impressions'],
                    dimensions: ['page'],
                    limit: 10,
                    time,
                }),
            }))
        }),
    ])

    return {
        days,
        from: time.from,
        to: time.to,
        application,
        traffic,
        search,
    }
})
