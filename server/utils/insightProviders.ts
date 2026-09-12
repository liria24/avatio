import { setups, users } from '@@/database/schema'
import type { H3Event } from '@nuxt/nitro-server/h3'
import { and, count, gte, isNull, lt, sql } from 'drizzle-orm'
import { defineProvider } from 'insight-ts'
import { googleSearchConsole } from 'insight-ts/google-search-console'
import { defineMetricAdapter } from 'insight-ts/metrics'

import { useDB } from './database'
import { getRuntimeEnvString } from './runtimeEnv'

const DAY_MS = 86_400_000

interface DailyCount {
    count: number
    day: string
}

export const cumulativeDailySeries = (
    baseline: number,
    counts: readonly DailyCount[],
    from: Date,
    to: Date,
) => {
    const byDay = new Map(counts.map((row) => [row.day, row.count]))
    const points = [{ time: from.toISOString(), value: baseline }]
    let value = baseline

    for (
        let day = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
        day < to.getTime();
        day += DAY_MS
    ) {
        const key = new Date(day).toISOString().slice(0, 10)
        value += byDay.get(key) ?? 0
        points.push({
            time: new Date(Math.min(day + DAY_MS - 1, to.getTime() - 1)).toISOString(),
            value,
        })
    }

    return points
}

const applicationMetrics = defineMetricAdapter({
    metrics: {
        totalUsers: {
            label: 'Total Users',
            aggregation: { kind: 'last' },
            rollup: 'non-additive',
            unit: '{user}',
        },
        activeSetups: {
            label: 'Active Setups',
            aggregation: { kind: 'last' },
            rollup: 'non-additive',
            unit: '{setup}',
        },
    },
    execute: async (query) => {
        const db = useDB()
        const from = new Date(query.time.from)
        const to = new Date(query.time.to)
        const userDay = sql<string>`date(${users.createdAt} / 1000, 'unixepoch')`
        const setupDay = sql<string>`date(${setups.createdAt} / 1000, 'unixepoch')`
        const [userBaseline, userCounts, setupBaseline, setupCounts] = await Promise.all([
            db.select({ count: count() }).from(users).where(lt(users.createdAt, from)),
            db
                .select({ count: count(), day: userDay })
                .from(users)
                .where(and(gte(users.createdAt, from), lt(users.createdAt, to)))
                .groupBy(userDay),
            db
                .select({ count: count() })
                .from(setups)
                .where(and(lt(setups.createdAt, from), isNull(setups.hidAt))),
            db
                .select({ count: count(), day: setupDay })
                .from(setups)
                .where(
                    and(
                        gte(setups.createdAt, from),
                        lt(setups.createdAt, to),
                        isNull(setups.hidAt),
                    ),
                )
                .groupBy(setupDay),
        ])
        const series = {
            totalUsers: cumulativeDailySeries(userBaseline[0]?.count ?? 0, userCounts, from, to),
            activeSetups: cumulativeDailySeries(
                setupBaseline[0]?.count ?? 0,
                setupCounts,
                from,
                to,
            ),
        }
        const metrics = query.metrics as (keyof typeof series)[]

        return {
            meta: {
                temporal: {
                    bucketTimezone: 'UTC',
                    grain: 'day',
                    sourceTimezone: 'UTC',
                },
            },
            points: series.totalUsers.map((point, index) => ({
                time: point.time,
                values: Object.fromEntries(
                    metrics.map((metric) => [metric, series[metric][index]?.value ?? null]),
                ),
            })),
            values: Object.fromEntries(
                metrics.map((metric) => [metric, series[metric].at(-1)?.value ?? 0]),
            ),
        }
    },
})

export const applicationInsightProvider = defineProvider({
    id: 'avatio',
    adapters: {
        application: applicationMetrics,
    },
})

let googleAccessToken = ''
let googleAccessTokenExpiresAt = 0

export const getGoogleSearchConsoleAccessToken = async () => {
    if (googleAccessToken && Date.now() < googleAccessTokenExpiresAt - 60_000)
        return googleAccessToken

    const clientId = getRuntimeEnvString('GOOGLE_SEARCH_CONSOLE_CLIENT_ID')
    const clientSecret = getRuntimeEnvString('GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET')
    const refreshToken = getRuntimeEnvString('GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN')
    if (!clientId || !clientSecret || !refreshToken)
        throw new Error('Google Search Console credentials are not configured')

    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
        }),
    })
    const payload: unknown = await response.json()
    const responseData =
        typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : {}
    const token =
        typeof responseData.access_token === 'string' ? responseData.access_token : undefined
    if (!response.ok || !token)
        throw new Error(`Google OAuth token refresh failed (${response.status})`)

    const expiresIn = typeof responseData.expires_in === 'number' ? responseData.expires_in : 3600
    googleAccessToken = token
    googleAccessTokenExpiresAt = Date.now() + expiresIn * 1000
    return token
}

export const googleSearchConsoleProvider = googleSearchConsole({
    property: 'sc-domain:avatio.me',
    auth: {
        getAccessToken: getGoogleSearchConsoleAccessToken,
    },
})

export const isGoogleSearchConsoleConfigured = (event: H3Event) =>
    Boolean(
        getRuntimeEnvString('GOOGLE_SEARCH_CONSOLE_CLIENT_ID', event) &&
        getRuntimeEnvString('GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET', event) &&
        getRuntimeEnvString('GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN', event),
    )

export const configureCloudflareInsight = (event: H3Event) => {
    const accountId = getRuntimeEnvString('CLOUDFLARE_ANALYTICS_ACCOUNT_ID', event) ?? ''
    const apiToken = getRuntimeEnvString('CLOUDFLARE_ANALYTICS_READ_TOKEN', event) ?? ''
    const host = getRuntimeEnvString('CLOUDFLARE_ANALYTICS_HOST', event) ?? ''
    const siteTag = getRuntimeEnvString('CLOUDFLARE_ANALYTICS_SITE_TAG', event) ?? ''

    Object.assign(useRuntimeConfig(event).cloudflare, { accountId, apiToken, host, siteTag })
    return Boolean(accountId && apiToken && siteTag)
}
