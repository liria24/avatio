<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'

const REPORTS_PER_PAGE = 20

type Tab = 'user' | 'setup' | 'item'
type Status = 'all' | 'open' | 'closed'
type Sort = 'asc' | 'desc'

const { t } = useI18n()
const { resolveReport } = useAdmin()

const _tab = useRouteQuery<Tab | null>('tab', null, { mode: 'push' })
const tab = computed<Tab>({
    get: () => (_tab.value === 'setup' || _tab.value === 'item' ? _tab.value : 'user'),
    set: (value) => {
        _tab.value = value === 'user' ? null : value
    },
})

const _status = useRouteQuery<Status | null>('status', null, { mode: 'push' })
const status = computed<Status>({
    get: () => (_status.value === 'all' || _status.value === 'closed' ? _status.value : 'open'),
    set: (value) => {
        _status.value = value === 'open' ? null : value
    },
})

const _sort = useRouteQuery<Sort | null>('sort', null, { mode: 'push' })
const sort = computed<Sort>({
    get: () => (_sort.value === 'asc' ? 'asc' : 'desc'),
    set: (value) => {
        _sort.value = value === 'desc' ? null : value
    },
})

const _page = useRouteQuery<string | null>('page', null, { mode: 'push' })
const page = computed<number>({
    get() {
        const value = Number(_page.value)
        return Number.isInteger(value) && value > 0 ? value : 1
    },
    set(value) {
        _page.value = value > 1 ? String(value) : null
    },
})

const tabItems = computed<TabsItem[]>(() => [
    { label: t('admin.reports.tabs.user'), value: 'user', icon: 'mingcute:user-warning-fill' },
    { label: t('admin.reports.tabs.setup'), value: 'setup', icon: 'mingcute:layout-7-fill' },
    { label: t('admin.reports.tabs.item'), value: 'item', icon: 'mingcute:box-3-fill' },
])

const statusItems = computed(() => [
    {
        label: t('admin.reports.status.all'),
        icon: 'mingcute:filter-fill',
        value: 'all',
    },
    {
        label: t('admin.reports.status.open'),
        icon: 'mingcute:three-quarters-circle-dash-fill',
        value: 'open',
    },
    {
        label: t('admin.reports.status.closed'),
        icon: 'lucide:circle-slash',
        value: 'closed',
    },
])

const sortItems = computed(() => [
    {
        label: t('admin.reports.sort.newest'),
        icon: 'mingcute:sort-descending-line',
        value: 'desc',
    },
    {
        label: t('admin.reports.sort.oldest'),
        icon: 'mingcute:sort-ascending-line',
        value: 'asc',
    },
])

const setTab = (value: string | number) => {
    tab.value = value as Tab
}

const defaultResponse = () => ({
    data: [],
    pagination: {
        page: 1,
        limit: REPORTS_PER_PAGE,
        total: 0,
        totalPages: 0,
        hasPrev: false,
        hasNext: false,
    },
})

const {
    data: userData,
    error: userError,
    refresh: refreshUser,
    status: userStatus,
} = await useFetch('/api/admin/reports/user', {
    dedupe: 'defer',
    query: { status, sort, page, limit: REPORTS_PER_PAGE },
    default: defaultResponse,
    immediate: tab.value === 'user',
    watch: false,
})

const {
    data: setupData,
    error: setupError,
    refresh: refreshSetup,
    status: setupStatus,
} = await useFetch('/api/admin/reports/setup', {
    dedupe: 'defer',
    query: { status, sort, page, limit: REPORTS_PER_PAGE },
    default: defaultResponse,
    immediate: tab.value === 'setup',
    watch: false,
})

const {
    data: itemData,
    error: itemError,
    refresh: refreshItem,
    status: itemStatus,
} = await useFetch('/api/admin/reports/item', {
    dedupe: 'defer',
    query: { status, sort, page, limit: REPORTS_PER_PAGE },
    default: defaultResponse,
    immediate: tab.value === 'item',
    watch: false,
})

const reportLists = {
    user: { data: userData, error: userError, refresh: refreshUser, status: userStatus },
    setup: { data: setupData, error: setupError, refresh: refreshSetup, status: setupStatus },
    item: { data: itemData, error: itemError, refresh: refreshItem, status: itemStatus },
}

const activeReports = computed(() => reportLists[tab.value])
const activeData = computed(() => activeReports.value.data.value)
const activePagination = computed(() => activeData.value.pagination)
const hasReports = computed(() => activeData.value.data.length > 0)
const isPending = computed(() => activeReports.value.status.value === 'pending')
const activeError = computed(() => activeReports.value.error.value)
const rangeStart = computed(() =>
    activePagination.value.total ? (page.value - 1) * activePagination.value.limit + 1 : 0,
)
const rangeEnd = computed(() =>
    Math.min(page.value * activePagination.value.limit, activePagination.value.total),
)

const refresh = () => activeReports.value.refresh()
const refreshAfterAction = () => {
    void refresh()
}

const { userReportActions, setupReportActions, itemReportActions } =
    useAdminReportActions(refreshAfterAction)

watch([tab, status, sort], () => {
    if (page.value === 1) void refresh()
    else page.value = 1
})

watch(page, () => void refresh())

const refreshAfterResolution = () => {
    if (status.value !== 'all' && activeData.value.data.length === 1 && page.value > 1)
        page.value -= 1
    else void refresh()
}

const resolve = (id: number, isResolved: boolean) =>
    resolveReport({
        type: tab.value,
        id,
        isResolved,
        onSuccess: refreshAfterResolution,
    })

useSeo({
    title: 'Admin - Reports',
})
</script>

<template>
    <UDashboardPanel id="reports" :ui="{ body: 'gap-0 p-0 sm:p-0' }">
        <template #header>
            <UDashboardNavbar :title="$t('admin.reports.title')">
                <template #right>
                    <UButton
                        loading-auto
                        :aria-label="$t('admin.reports.actions.refresh')"
                        icon="mingcute:refresh-2-line"
                        variant="ghost"
                        size="sm"
                        @click="refresh()"
                    />
                </template>
            </UDashboardNavbar>

            <UDashboardToolbar
                :ui="{
                    root: 'flex-col items-stretch gap-2 sm:flex-row sm:items-center',
                    left: 'min-w-0 overflow-x-auto',
                    right: 'flex flex-wrap gap-2 sm:ml-auto',
                }"
            >
                <template #left>
                    <UTabs
                        :model-value="tab"
                        :items="tabItems"
                        :content="false"
                        activation-mode="manual"
                        color="neutral"
                        size="sm"
                        @update:model-value="setTab"
                    >
                        <template #default="{ item }">
                            <span :id="`report-tab-${item.value}`">{{ item.label }}</span>
                        </template>
                    </UTabs>
                </template>

                <template #right>
                    <USelect
                        v-model="status"
                        :items="statusItems"
                        :aria-label="$t('admin.reports.status.label')"
                        class="min-w-32 flex-1 sm:flex-none"
                    />
                    <USelect
                        v-model="sort"
                        :items="sortItems"
                        :aria-label="$t('admin.reports.sort.label')"
                        class="min-w-36 flex-1 sm:flex-none"
                    />
                </template>
            </UDashboardToolbar>
        </template>

        <template #body>
            <div
                role="tabpanel"
                :aria-labelledby="`report-tab-${tab}`"
                :aria-busy="isPending"
                tabindex="0"
                class="flex min-h-0 grow flex-col gap-4 p-3 focus-visible:outline-2 focus-visible:outline-offset-[-2px] sm:p-5"
            >
                <UProgress v-if="isPending && hasReports" size="xs" animation="carousel" />

                <UAlert
                    v-if="activeError"
                    data-testid="report-error"
                    :title="$t('admin.reports.error.title')"
                    :description="$t('admin.reports.error.description')"
                    icon="mingcute:warning-fill"
                    color="error"
                    variant="subtle"
                >
                    <template #actions>
                        <UButton
                            :label="$t('admin.reports.actions.retry')"
                            icon="mingcute:refresh-2-line"
                            color="error"
                            variant="soft"
                            size="sm"
                            @click="refresh()"
                        />
                    </template>
                </UAlert>

                <UEmpty
                    v-else-if="isPending && !hasReports"
                    data-testid="report-loading"
                    :title="$t('admin.reports.loading')"
                    loading
                    class="min-h-72"
                />

                <UEmpty
                    v-else-if="!hasReports"
                    data-testid="report-empty"
                    :title="$t('admin.reports.empty.title')"
                    :description="$t('admin.reports.empty.description')"
                    icon="mingcute:inbox-line"
                    variant="subtle"
                    class="min-h-72"
                />

                <AdminReportCards
                    v-else
                    :tab="tab"
                    :user-reports="userData.data"
                    :setup-reports="setupData.data"
                    :item-reports="itemData.data"
                    :user-actions="userReportActions"
                    :setup-actions="setupReportActions"
                    :item-actions="itemReportActions"
                    @resolve="resolve"
                />

                <div
                    v-if="!activeError && activePagination.totalPages > 1"
                    data-testid="report-pagination"
                    class="border-default flex flex-col items-center justify-between gap-3 border-t pt-4 sm:flex-row"
                >
                    <p class="text-muted text-xs">
                        {{
                            $t('admin.reports.pagination', {
                                start: rangeStart,
                                end: rangeEnd,
                                total: activePagination.total,
                            })
                        }}
                    </p>
                    <UPagination
                        v-model:page="page"
                        :total="activePagination.total"
                        :items-per-page="activePagination.limit"
                        show-edges
                        size="sm"
                    />
                </div>
            </div>
        </template>
    </UDashboardPanel>
</template>
