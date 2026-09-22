<script setup lang="ts">
import type { DropdownMenuItem, TabsItem } from '@nuxt/ui'

const REPORTS_PER_PAGE = 20

type Tab = 'user' | 'setup' | 'item'
type Status = 'all' | 'open' | 'closed'
type Sort = 'asc' | 'desc'

const { t } = useI18n()
const { resolveReport, unbanUser } = useAdmin()
const banUser = useBanUserModal()
const setupHide = useSetupHideModal()
const setupUnhide = useSetupUnhideModal()
const changeItemNiceName = useChangeItemNiceNameModal()
const itemCategory = useItemCategory()
const setupPath = useSetupPath()

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

type UserReport = (typeof userData.value.data)[number]
type SetupReport = (typeof setupData.value.data)[number]
type ItemReport = (typeof itemData.value.data)[number]

const userReportActions = (report: UserReport): DropdownMenuItem[][] => [
    [
        {
            label: t('admin.reports.actions.viewUser'),
            icon: 'mingcute:user-3-fill',
            to: `/@${report.reportee.username}`,
            target: '_blank',
        },
    ],
    [
        {
            label: report.reportee.banned
                ? t('admin.reports.actions.unbanUser')
                : t('admin.reports.actions.banUser'),
            icon: report.reportee.banned ? 'mingcute:back-fill' : 'mingcute:forbid-circle-fill',
            onSelect: () => {
                if (report.reportee.banned) {
                    void unbanUser({
                        userId: report.reportee.id,
                        onSuccess: refreshAfterAction,
                    })
                    return
                }

                banUser.open({
                    userId: report.reportee.id,
                    username: report.reportee.username,
                    name: report.reportee.name,
                    image: report.reportee.image,
                    onSuccess: refreshAfterAction,
                })
            },
        },
    ],
]

const setupReportActions = (report: SetupReport): DropdownMenuItem[][] => [
    [
        {
            label: t('admin.reports.actions.viewSetup'),
            icon: 'mingcute:external-link-line',
            to: setupPath(report.setup.id),
            target: '_blank',
        },
    ],
    [
        {
            label: report.setup.hidAt
                ? t('admin.reports.actions.unhideSetup')
                : t('admin.reports.actions.hideSetup'),
            icon: report.setup.hidAt ? 'mingcute:eye-fill' : 'mingcute:eye-close-line',
            onSelect: () => {
                const props = { setupId: report.setup.id, onSuccess: refreshAfterAction }
                if (report.setup.hidAt) setupUnhide.open(props)
                else setupHide.open(props)
            },
        },
    ],
]

const itemReportActions = (report: ItemReport): DropdownMenuItem[][] => [
    [
        {
            label: t('admin.reports.actions.viewSource'),
            icon: 'mingcute:external-link-line',
            to: report.item.primarySource?.canonicalUrl,
            target: '_blank',
            disabled: !report.item.primarySource?.canonicalUrl,
        },
    ],
    [
        {
            label: t('admin.reports.actions.changeItemName'),
            icon: 'mingcute:edit-3-line',
            onSelect: () =>
                changeItemNiceName.open({
                    itemId: report.item.id,
                    current: report.item.displayNameOverride || '',
                    onSuccess: refreshAfterAction,
                }),
        },
    ],
]

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
                        color="neutral"
                        size="sm"
                        @update:model-value="setTab"
                    />
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
            <div class="flex min-h-0 grow flex-col gap-4 p-3 sm:p-5">
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

                <UPageList v-else class="gap-4">
                    <template v-if="tab === 'user'">
                        <UCard v-for="report in userData.data" :key="report.id">
                            <template #header>
                                <AdminReportHeader
                                    :id="report.id"
                                    :is-resolved="report.isResolved"
                                    :created-at="report.createdAt"
                                    :reporter="report.reporter"
                                    @resolve="resolve"
                                >
                                    <UDropdownMenu :items="userReportActions(report)">
                                        <UButton
                                            :aria-label="$t('admin.reports.actions.label')"
                                            icon="mingcute:more-2-line"
                                            color="neutral"
                                            variant="outline"
                                            size="sm"
                                        />
                                    </UDropdownMenu>
                                </AdminReportHeader>
                            </template>

                            <div class="grid w-full grid-cols-1 items-start gap-4 sm:grid-cols-2">
                                <UPageCard
                                    :to="`/@${report.reportee.username}`"
                                    target="_blank"
                                    :ui="{ container: 'p-2 sm:p-2' }"
                                >
                                    <UUser
                                        :name="report.reportee.name"
                                        :description="`@${report.reportee.username}`"
                                        :avatar="{
                                            src: report.reportee.image || undefined,
                                            alt: report.reportee.name,
                                            icon: 'mingcute:user-3-fill',
                                        }"
                                    >
                                        <template #trailing>
                                            <UBadge
                                                v-if="report.reportee.banned"
                                                :label="$t('admin.reports.user.banned')"
                                                color="error"
                                                variant="subtle"
                                            />
                                        </template>
                                    </UUser>
                                </UPageCard>

                                <div class="flex w-full flex-col gap-2">
                                    <div class="flex flex-wrap items-center gap-1">
                                        <UBadge
                                            v-if="report.spam"
                                            :label="$t('admin.reports.user.reasons.spam')"
                                            variant="outline"
                                            class="rounded-full px-2"
                                        />
                                        <UBadge
                                            v-if="report.hate"
                                            :label="$t('admin.reports.user.reasons.malicious')"
                                            variant="outline"
                                            class="rounded-full px-2"
                                        />
                                        <UBadge
                                            v-if="report.infringe"
                                            :label="$t('admin.reports.user.reasons.infringement')"
                                            variant="outline"
                                            class="rounded-full px-2"
                                        />
                                        <UBadge
                                            v-if="report.badImage"
                                            :label="$t('admin.reports.user.reasons.inappropriate')"
                                            variant="outline"
                                            class="rounded-full px-2"
                                        />
                                        <UBadge
                                            v-if="report.other"
                                            :label="$t('admin.reports.user.reasons.other')"
                                            variant="outline"
                                            class="rounded-full px-2"
                                        />
                                    </div>

                                    <p
                                        v-if="report.comment?.length"
                                        class="text-toned ring-muted w-full rounded-xl px-3 py-1.5 text-sm break-words whitespace-pre-wrap ring-1"
                                    >
                                        {{ report.comment }}
                                    </p>
                                </div>
                            </div>
                        </UCard>
                    </template>

                    <template v-else-if="tab === 'setup'">
                        <UCard v-for="report in setupData.data" :key="report.id">
                            <template #header>
                                <AdminReportHeader
                                    :id="report.id"
                                    :is-resolved="report.isResolved"
                                    :created-at="report.createdAt"
                                    :reporter="report.reporter"
                                    @resolve="resolve"
                                >
                                    <UDropdownMenu :items="setupReportActions(report)">
                                        <UButton
                                            :aria-label="$t('admin.reports.actions.label')"
                                            icon="mingcute:more-2-line"
                                            color="neutral"
                                            variant="outline"
                                            size="sm"
                                        />
                                    </UDropdownMenu>
                                </AdminReportHeader>
                            </template>

                            <div class="grid w-full grid-cols-1 items-start gap-4 sm:grid-cols-2">
                                <UPageCard
                                    :to="setupPath(report.setup.id)"
                                    target="_blank"
                                    :ui="{ container: 'p-2 sm:p-2' }"
                                >
                                    <div class="flex items-center gap-3">
                                        <NuxtImg
                                            v-if="report.setup.images?.length"
                                            :src="report.setup.images[0]?.url"
                                            class="aspect-square size-16 shrink-0 rounded-lg object-cover"
                                        />

                                        <div class="flex min-w-0 flex-col gap-1">
                                            <p class="text-sm leading-tight font-medium">
                                                {{ report.setup.name }}
                                            </p>
                                            <UBadge
                                                v-if="report.setup.hidAt"
                                                :label="$t('admin.reports.setup.hidden')"
                                                color="warning"
                                                variant="subtle"
                                                class="w-fit"
                                            />
                                        </div>
                                    </div>
                                </UPageCard>

                                <div class="flex w-full flex-col gap-2">
                                    <div class="flex flex-wrap items-center gap-1">
                                        <UBadge
                                            v-if="report.spam"
                                            :label="$t('admin.reports.setup.reasons.spam')"
                                            variant="outline"
                                            class="rounded-full px-2"
                                        />
                                        <UBadge
                                            v-if="report.hate"
                                            :label="$t('admin.reports.setup.reasons.hate')"
                                            variant="outline"
                                            class="rounded-full px-2"
                                        />
                                        <UBadge
                                            v-if="report.infringe"
                                            :label="$t('admin.reports.setup.reasons.infringement')"
                                            variant="outline"
                                            class="rounded-full px-2"
                                        />
                                        <UBadge
                                            v-if="report.badImage"
                                            :label="$t('admin.reports.setup.reasons.extreme')"
                                            variant="outline"
                                            class="rounded-full px-2"
                                        />
                                        <UBadge
                                            v-if="report.other"
                                            :label="$t('admin.reports.setup.reasons.other')"
                                            variant="outline"
                                            class="rounded-full px-2"
                                        />
                                    </div>

                                    <p
                                        v-if="report.comment?.length"
                                        class="text-toned ring-muted w-full rounded-xl px-3 py-1.5 text-sm break-words whitespace-pre-wrap ring-1"
                                    >
                                        {{ report.comment }}
                                    </p>
                                </div>
                            </div>
                        </UCard>
                    </template>

                    <template v-else>
                        <UCard v-for="report in itemData.data" :key="report.id">
                            <template #header>
                                <AdminReportHeader
                                    :id="report.id"
                                    :is-resolved="report.isResolved"
                                    :created-at="report.createdAt"
                                    :reporter="report.reporter"
                                    @resolve="resolve"
                                >
                                    <UDropdownMenu :items="itemReportActions(report)">
                                        <UButton
                                            :aria-label="$t('admin.reports.actions.label')"
                                            icon="mingcute:more-2-line"
                                            color="neutral"
                                            variant="outline"
                                            size="sm"
                                        />
                                    </UDropdownMenu>
                                </AdminReportHeader>
                            </template>

                            <div class="grid w-full grid-cols-1 items-start gap-4 sm:grid-cols-2">
                                <UPageCard
                                    :to="report.item.primarySource?.canonicalUrl"
                                    target="_blank"
                                    :ui="{ container: 'p-2 sm:p-2' }"
                                >
                                    <div class="flex items-center gap-1">
                                        <NuxtImg
                                            v-if="report.item.image"
                                            :src="report.item.image"
                                            class="aspect-square size-16 shrink-0 rounded-lg object-cover"
                                        />

                                        <div class="flex min-w-0 flex-col gap-1 px-2">
                                            <p
                                                class="text-sm leading-tight font-medium break-words"
                                            >
                                                {{
                                                    report.item.displayNameOverride ||
                                                    report.item.name
                                                }}
                                            </p>

                                            <p
                                                class="text-dimmed line-clamp-1 text-[10px] leading-tight break-all"
                                            >
                                                {{ report.item.name }}
                                            </p>

                                            <div class="flex flex-wrap items-center gap-1">
                                                <UBadge
                                                    :label="report.item.primarySource?.providerKey"
                                                    variant="outline"
                                                    size="sm"
                                                    class="rounded-full px-2.5"
                                                />
                                                <UBadge
                                                    :label="
                                                        itemCategory[
                                                            report.item
                                                                .category as keyof typeof itemCategory
                                                        ].label
                                                    "
                                                    variant="outline"
                                                    size="sm"
                                                    class="rounded-full px-2.5"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </UPageCard>

                                <div class="flex w-full flex-col gap-2">
                                    <div class="flex flex-wrap items-center gap-1">
                                        <UBadge
                                            v-if="report.nameError"
                                            :label="$t('admin.reports.item.reasons.wrongName')"
                                            variant="outline"
                                            class="rounded-full px-2"
                                        />
                                        <UBadge
                                            v-if="report.irrelevant"
                                            :label="$t('admin.reports.item.reasons.unrelated')"
                                            variant="outline"
                                            class="rounded-full px-2"
                                        />
                                        <UBadge
                                            v-if="report.other"
                                            :label="$t('admin.reports.item.reasons.other')"
                                            variant="outline"
                                            class="rounded-full px-2"
                                        />
                                    </div>

                                    <p
                                        v-if="report.comment?.length"
                                        class="text-toned ring-muted w-full rounded-xl px-3 py-1.5 text-sm break-words whitespace-pre-wrap ring-1"
                                    >
                                        {{ report.comment }}
                                    </p>
                                </div>
                            </div>
                        </UCard>
                    </template>
                </UPageList>

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
