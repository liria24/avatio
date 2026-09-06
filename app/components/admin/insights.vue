<script lang="ts" setup>
import type { MetricQueryResult } from 'insight-ts/ui-core'
import {
    InsightAreaChart,
    InsightBarChart,
    InsightQualityNotice,
    InsightSparkline,
    InsightStat,
} from 'insight-ts/vue/ui'

import 'insight-ts/vue/ui/style.css'

type InsightSection<T> =
    | { status: 'ok'; data: T }
    | { status: 'unconfigured' }
    | { status: 'error' }

interface AdminInsightsResponse {
    application: InsightSection<MetricQueryResult>
    traffic: InsightSection<{
        totals: MetricQueryResult
        series: MetricQueryResult
        pages: MetricQueryResult
        countries: MetricQueryResult
        devices: MetricQueryResult
        referrers: MetricQueryResult
    }>
    search: InsightSection<{
        totals: MetricQueryResult
        series: MetricQueryResult
        queries: MetricQueryResult
        pages: MetricQueryResult
    }>
}

const ranges = [7, 30, 90] as const
const days = ref<(typeof ranges)[number]>(30)
const { data, error, refresh, status } = await useFetch<AdminInsightsResponse>(
    '/api/admin/insights',
    {
        query: { days },
    },
)

const metric = (result: MetricQueryResult, name: string): MetricQueryResult => ({
    data: { [name]: result.data[name] } as MetricQueryResult['data'],
    meta: result.meta,
})
const percentage = (value: number) =>
    new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1 }).format(value)
const decimal = (value: number) =>
    new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value)
</script>

<template>
    <div class="flex flex-col gap-8">
        <div class="flex flex-wrap items-center gap-2">
            <h2 class="text-toned font-mono leading-none font-bold">Insights</h2>
            <div class="ml-auto flex gap-1" role="group" aria-label="Insight date range">
                <UButton
                    v-for="range in ranges"
                    :key="range"
                    :label="`${range} days`"
                    :variant="days === range ? 'soft' : 'ghost'"
                    color="neutral"
                    size="sm"
                    :disabled="status === 'pending'"
                    @click="days = range"
                />
            </div>
        </div>

        <UAlert
            v-if="error"
            color="error"
            title="Insights could not be loaded"
            description="The admin API request failed."
            :actions="[{ label: 'Retry', onClick: () => refresh() }]"
        />

        <template v-if="data">
            <section class="flex flex-col gap-4">
                <h3 class="text-toned font-mono leading-none font-bold">Application</h3>

                <UAlert
                    v-if="data.application.status === 'error'"
                    color="error"
                    title="Application insights are unavailable"
                    description="Other providers can still be viewed."
                />

                <UPageGrid
                    v-else-if="data.application.status === 'ok'"
                    class="gap-2 sm:gap-4 lg:grid-cols-2"
                >
                    <UPageCard to="/admin/users" variant="subtle" class="rounded-lg">
                        <InsightStat
                            :data="metric(data.application.data, 'totalUsers')"
                            label="Total Users"
                        />
                        <InsightSparkline
                            :data="metric(data.application.data, 'totalUsers')"
                            class="mt-4 w-full"
                            :width="640"
                            :height="72"
                        />
                    </UPageCard>
                    <UPageCard to="/admin/setups" variant="subtle" class="rounded-lg">
                        <InsightStat
                            :data="metric(data.application.data, 'activeSetups')"
                            label="Active Setups"
                        />
                        <InsightSparkline
                            :data="metric(data.application.data, 'activeSetups')"
                            class="mt-4 w-full"
                            :width="640"
                            :height="72"
                        />
                    </UPageCard>
                </UPageGrid>
            </section>

            <section class="flex flex-col gap-4">
                <h3 class="text-toned font-mono leading-none font-bold">
                    Cloudflare Web Analytics
                </h3>

                <UAlert
                    v-if="data.traffic.status === 'unconfigured'"
                    color="neutral"
                    title="Cloudflare Web Analytics is not configured"
                    description="Add the optional read token to enable this section."
                />
                <UAlert
                    v-else-if="data.traffic.status === 'error'"
                    color="error"
                    title="Cloudflare Web Analytics is unavailable"
                    description="Application and Search Console insights are unaffected."
                />

                <template v-else>
                    <UPageGrid class="gap-2 sm:gap-4 lg:grid-cols-2">
                        <UPageCard variant="subtle" class="rounded-lg">
                            <InsightStat
                                :data="metric(data.traffic.data.totals, 'pageViews')"
                                label="Page Views"
                            />
                        </UPageCard>
                        <UPageCard variant="subtle" class="rounded-lg">
                            <InsightStat
                                :data="metric(data.traffic.data.totals, 'visits')"
                                label="Visits"
                            />
                        </UPageCard>
                    </UPageGrid>

                    <UPageCard variant="subtle" class="rounded-lg">
                        <InsightAreaChart
                            :data="data.traffic.data.series"
                            title="Daily Traffic"
                            :height="280"
                            smooth
                        />
                        <InsightQualityNotice :data="data.traffic.data.series.meta.quality" />
                    </UPageCard>

                    <UPageGrid class="gap-2 sm:gap-4 lg:grid-cols-2">
                        <UPageCard title="Top Pages" variant="subtle" class="rounded-lg">
                            <InsightBarChart :data="data.traffic.data.pages" dimension="path" />
                        </UPageCard>
                        <UPageCard title="Top Countries" variant="subtle" class="rounded-lg">
                            <InsightBarChart
                                :data="data.traffic.data.countries"
                                dimension="country"
                            />
                        </UPageCard>
                        <UPageCard title="Top Devices" variant="subtle" class="rounded-lg">
                            <InsightBarChart :data="data.traffic.data.devices" dimension="device" />
                        </UPageCard>
                        <UPageCard title="Top Referrers" variant="subtle" class="rounded-lg">
                            <InsightBarChart
                                :data="data.traffic.data.referrers"
                                dimension="referer"
                            />
                        </UPageCard>
                    </UPageGrid>
                </template>
            </section>

            <section class="flex flex-col gap-4">
                <h3 class="text-toned font-mono leading-none font-bold">Google Search Console</h3>

                <UAlert
                    v-if="data.search.status === 'unconfigured'"
                    color="neutral"
                    title="Google Search Console is not configured"
                    description="Add the optional OAuth credentials to enable this section."
                />
                <UAlert
                    v-else-if="data.search.status === 'error'"
                    color="error"
                    title="Google Search Console is unavailable"
                    description="Application and Cloudflare insights are unaffected."
                />

                <template v-else>
                    <UPageGrid class="gap-2 sm:gap-4 lg:grid-cols-4">
                        <UPageCard variant="subtle" class="rounded-lg">
                            <InsightStat
                                :data="metric(data.search.data.totals, 'clicks')"
                                label="Clicks"
                            />
                        </UPageCard>
                        <UPageCard variant="subtle" class="rounded-lg">
                            <InsightStat
                                :data="metric(data.search.data.totals, 'impressions')"
                                label="Impressions"
                            />
                        </UPageCard>
                        <UPageCard variant="subtle" class="rounded-lg">
                            <InsightStat
                                :data="metric(data.search.data.totals, 'ctr')"
                                label="CTR"
                                :formatter="percentage"
                            />
                        </UPageCard>
                        <UPageCard variant="subtle" class="rounded-lg">
                            <InsightStat
                                :data="metric(data.search.data.totals, 'averagePosition')"
                                label="Average Position"
                                :formatter="decimal"
                            />
                        </UPageCard>
                    </UPageGrid>

                    <UPageGrid class="gap-2 sm:gap-4 lg:grid-cols-2">
                        <UPageCard variant="subtle" class="rounded-lg">
                            <InsightAreaChart
                                :data="metric(data.search.data.series, 'clicks')"
                                title="Daily Clicks"
                                :height="240"
                                smooth
                            />
                        </UPageCard>
                        <UPageCard variant="subtle" class="rounded-lg">
                            <InsightAreaChart
                                :data="metric(data.search.data.series, 'impressions')"
                                title="Daily Impressions"
                                :height="240"
                                smooth
                            />
                        </UPageCard>
                        <UPageCard variant="subtle" class="rounded-lg">
                            <InsightAreaChart
                                :data="metric(data.search.data.series, 'ctr')"
                                title="Daily CTR"
                                :height="240"
                                :y-axis="{ formatter: percentage }"
                                smooth
                            />
                        </UPageCard>
                        <UPageCard variant="subtle" class="rounded-lg">
                            <InsightAreaChart
                                :data="metric(data.search.data.series, 'averagePosition')"
                                title="Daily Average Position"
                                :height="240"
                                :y-axis="{ formatter: decimal }"
                                smooth
                            />
                        </UPageCard>
                    </UPageGrid>
                    <InsightQualityNotice :data="data.search.data.series.meta.quality" />

                    <UPageGrid class="gap-2 sm:gap-4 lg:grid-cols-2">
                        <UPageCard title="Top Queries" variant="subtle" class="rounded-lg">
                            <InsightBarChart :data="data.search.data.queries" dimension="query" />
                        </UPageCard>
                        <UPageCard title="Top Pages" variant="subtle" class="rounded-lg">
                            <InsightBarChart :data="data.search.data.pages" dimension="page" />
                        </UPageCard>
                    </UPageGrid>
                </template>
            </section>
        </template>
    </div>
</template>
