<script setup lang="ts">
const { locale } = useI18n()
const { resolveReport } = useAdminActions()
const itemCategory = useItemCategory()
const changeItemNiceName = useChangeItemNiceNameModal()

type Tab = 'user' | 'setup' | 'item'

const _tab = useRouteQuery<Tab | null>('tab', null, { mode: 'push' })

const tab = computed<Tab>({
    get() {
        const val = _tab.value
        if (val === 'user' || val === 'setup' || val === 'item') return val
        return 'user'
    },
    set(newTab: Tab) {
        _tab.value = newTab !== 'user' ? newTab : null
    },
})

type Status = 'all' | 'open' | 'closed'

const _status = useRouteQuery<Status | null>('status', null, { mode: 'push' })

const status = computed<Status>({
    get() {
        const val = _status.value
        if (val === 'all' || val === 'closed') return val
        return 'open'
    },
    set(newStatus: Status) {
        _status.value = newStatus !== 'open' ? newStatus : null
    },
})

const defaultResponse = () => ({
    data: [],
    pagination: {
        page: 1,
        limit: 0,
        total: 0,
        totalPages: 0,
        hasPrev: false,
        hasNext: false,
    },
})

const { data: userData, refresh: refreshUser } = await useFetch('/api/admin/reports/user', {
    dedupe: 'defer',
    query: { status },
    default: defaultResponse,
})

const { data: setupData, refresh: refreshSetup } = await useFetch('/api/admin/reports/setup', {
    dedupe: 'defer',
    query: { status },
    default: defaultResponse,
})

const { data: itemData, refresh: refreshItem } = await useFetch('/api/admin/reports/item', {
    dedupe: 'defer',
    query: { status },
    default: defaultResponse,
})

const refresh = () => {
    if (tab.value === 'setup') return refreshSetup()
    if (tab.value === 'item') return refreshItem()
    return refreshUser()
}

const resolve = async (id: number, resolved?: boolean) => {
    const success = await resolveReport(tab.value, id, resolved ?? true)
    if (success) refresh()
}
</script>

<template>
    <UDashboardPanel id="reports">
        <template #header>
            <UDashboardNavbar :ui="{ left: 'flex flex-wrap items-center gap-1' }">
                <template #left>
                    <UButton
                        label="User"
                        :active="tab === 'user'"
                        variant="ghost"
                        active-variant="solid"
                        color="neutral"
                        class="px-4 py-2"
                        @click="tab = 'user'"
                    />
                    <UButton
                        label="Setup"
                        :active="tab === 'setup'"
                        variant="ghost"
                        active-variant="solid"
                        color="neutral"
                        class="px-4 py-2"
                        @click="tab = 'setup'"
                    />
                    <UButton
                        label="Item"
                        :active="tab === 'item'"
                        variant="ghost"
                        active-variant="solid"
                        color="neutral"
                        class="px-4 py-2"
                        @click="tab = 'item'"
                    />
                </template>

                <template #right>
                    <UButton
                        loading-auto
                        icon="mingcute:refresh-2-line"
                        variant="ghost"
                        size="sm"
                        @click="refresh()"
                    />
                    <USelect
                        v-model="status"
                        :items="[
                            {
                                label: 'All',
                                icon: 'mingcute:filter-fill',
                                value: 'all',
                            },
                            {
                                label: 'Open',
                                icon: 'mingcute:three-quarters-circle-dash-fill',
                                value: 'open',
                            },
                            {
                                label: 'Closed',
                                icon: 'lucide:circle-slash',
                                value: 'closed',
                            },
                        ]"
                        class="min-w-32"
                    />
                </template>
            </UDashboardNavbar>
        </template>

        <template #body>
            <UPageList class="gap-4">
                <!-- User Tab -->
                <template v-if="tab === 'user'">
                    <UCard v-for="report in userData.data" :key="report.id">
                        <template #header>
                            <div class="flex w-full items-center gap-2">
                                <span
                                    class="text-muted text-lg leading-none font-light text-nowrap"
                                >
                                    #{{ report.id }}
                                </span>
                                <UBadge
                                    :label="report.isResolved ? 'Closed' : 'Open'"
                                    :icon="
                                        report.isResolved
                                            ? 'lucide:circle-slash'
                                            : 'mingcute:three-quarters-circle-dash-fill'
                                    "
                                    :color="report.isResolved ? 'neutral' : 'success'"
                                    variant="outline"
                                    class="rounded-full py-1.5 pr-3 pl-2.5"
                                />
                                <NuxtTime
                                    :datetime="report.createdAt"
                                    relative
                                    :locale
                                    class="text-muted text-xs"
                                />

                                <div class="flex grow items-center justify-end gap-2">
                                    <UUser
                                        :avatar="{
                                            src: report.reporter.image || undefined,
                                            alt: report.reporter.name,
                                            icon: 'mingcute:user-3-fill',
                                        }"
                                        :name="report.reporter.name"
                                        size="sm"
                                        class="mr-2"
                                    />

                                    <UButton
                                        v-if="report.isResolved"
                                        loading-auto
                                        icon="mingcute:close-line"
                                        label="Mark as Unresolved"
                                        color="neutral"
                                        variant="subtle"
                                        size="sm"
                                        @click="resolve(report.id, false)"
                                    />
                                    <UButton
                                        v-else
                                        loading-auto
                                        icon="mingcute:check-line"
                                        label="Mark as Resolved"
                                        color="neutral"
                                        size="sm"
                                        @click="resolve(report.id)"
                                    />
                                </div>
                            </div>
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
                                />
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
                                    class="text-toned ring-muted w-full rounded-xl px-3 py-1.5 text-sm ring-1"
                                >
                                    {{ report.comment }}
                                </p>
                            </div>
                        </div>
                    </UCard>
                </template>

                <!-- Setup Tab -->
                <template v-else-if="tab === 'setup'">
                    <UCard v-for="report in setupData.data" :key="report.id">
                        <template #header>
                            <div class="flex w-full items-center gap-2">
                                <span
                                    class="text-muted text-lg leading-none font-light text-nowrap"
                                >
                                    #{{ report.id }}
                                </span>
                                <UBadge
                                    :label="report.isResolved ? 'Closed' : 'Open'"
                                    :icon="
                                        report.isResolved
                                            ? 'lucide:circle-slash'
                                            : 'mingcute:three-quarters-circle-dash-fill'
                                    "
                                    :color="report.isResolved ? 'neutral' : 'success'"
                                    variant="outline"
                                    class="rounded-full py-1.5 pr-3 pl-2.5"
                                />
                                <NuxtTime
                                    :datetime="report.createdAt"
                                    relative
                                    :locale
                                    class="text-muted text-xs"
                                />

                                <div class="flex grow items-center justify-end gap-2">
                                    <UUser
                                        :avatar="{
                                            src: report.reporter.image || undefined,
                                            alt: report.reporter.name,
                                            icon: 'mingcute:user-3-fill',
                                        }"
                                        :name="report.reporter.name"
                                        size="sm"
                                        class="mr-2"
                                    />

                                    <UButton
                                        v-if="report.isResolved"
                                        loading-auto
                                        icon="mingcute:close-line"
                                        label="Mark as Unresolved"
                                        color="neutral"
                                        variant="subtle"
                                        size="sm"
                                        @click="resolve(report.id, false)"
                                    />
                                    <UButton
                                        v-else
                                        loading-auto
                                        icon="mingcute:check-line"
                                        label="Mark as Resolved"
                                        color="neutral"
                                        size="sm"
                                        @click="resolve(report.id)"
                                    />
                                </div>
                            </div>
                        </template>

                        <div class="grid w-full grid-cols-1 items-start gap-4 sm:grid-cols-2">
                            <UPageCard
                                :to="report.setup?.id ? `/setup/${report.setup.id}` : undefined"
                                target="_blank"
                                :ui="{ container: 'p-2 sm:p-2' }"
                            >
                                <div class="flex items-center gap-3">
                                    <NuxtImg
                                        v-if="report.setup.images?.length"
                                        :src="report.setup.images[0]?.url"
                                        class="aspect-square size-16 shrink-0 rounded-lg object-cover"
                                    />

                                    <p class="text-sm leading-tight font-medium">
                                        {{ report.setup.name }}
                                    </p>
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
                                    class="text-toned ring-muted w-full rounded-xl px-3 py-1.5 text-sm ring-1"
                                >
                                    {{ report.comment }}
                                </p>
                            </div>
                        </div>
                    </UCard>
                </template>

                <!-- Item Tab -->
                <template v-else>
                    <UCard v-for="report in itemData.data" :key="report.id">
                        <template #header>
                            <div class="flex w-full items-center gap-2">
                                <span
                                    class="text-muted text-lg leading-none font-light text-nowrap"
                                >
                                    #{{ report.id }}
                                </span>
                                <UBadge
                                    :label="report.isResolved ? 'Closed' : 'Open'"
                                    :icon="
                                        report.isResolved
                                            ? 'lucide:circle-slash'
                                            : 'mingcute:three-quarters-circle-dash-fill'
                                    "
                                    :color="report.isResolved ? 'neutral' : 'success'"
                                    variant="outline"
                                    class="rounded-full py-1.5 pr-3 pl-2.5"
                                />
                                <NuxtTime
                                    :datetime="report.createdAt"
                                    relative
                                    :locale
                                    class="text-muted text-xs"
                                />

                                <div class="flex grow items-center justify-end gap-2">
                                    <UUser
                                        :avatar="{
                                            src: report.reporter.image || undefined,
                                            alt: report.reporter.name,
                                            icon: 'mingcute:user-3-fill',
                                        }"
                                        :name="report.reporter.name"
                                        size="sm"
                                        class="mr-2"
                                    />

                                    <UButton
                                        label="Change Nice Name"
                                        variant="outline"
                                        color="neutral"
                                        size="sm"
                                        @click="
                                            changeItemNiceName.open({
                                                itemId: report.item.id,
                                                current: report.item.niceName || '',
                                            })
                                        "
                                    />

                                    <UButton
                                        v-if="report.isResolved"
                                        loading-auto
                                        icon="mingcute:close-line"
                                        label="Mark as Unresolved"
                                        color="neutral"
                                        variant="subtle"
                                        size="sm"
                                        @click="resolve(report.id, false)"
                                    />
                                    <UButton
                                        v-else
                                        loading-auto
                                        icon="mingcute:check-line"
                                        label="Mark as Resolved"
                                        color="neutral"
                                        size="sm"
                                        @click="resolve(report.id)"
                                    />
                                </div>
                            </div>
                        </template>

                        <div class="grid w-full grid-cols-1 items-start gap-4 sm:grid-cols-2">
                            <UPageCard
                                :to="computeItemUrl(report.item.id, report.item.platform)"
                                target="_blank"
                                :ui="{ container: 'p-2 sm:p-2' }"
                            >
                                <div class="flex items-center gap-1">
                                    <NuxtImg
                                        v-if="report.item.image"
                                        :src="report.item.image"
                                        class="aspect-square size-16 shrink-0 rounded-lg object-cover"
                                    />

                                    <div class="flex flex-col gap-1 px-2">
                                        <p class="text-sm leading-tight font-medium">
                                            {{ report.item.niceName || report.item.name }}
                                        </p>

                                        <p
                                            class="text-dimmed line-clamp-1 text-[10px] leading-tight break-all"
                                        >
                                            {{ report.item.name }}
                                        </p>

                                        <div class="flex items-center gap-1">
                                            <UBadge
                                                :label="report.item.platform"
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
                                    class="text-toned ring-muted w-full rounded-xl px-3 py-1.5 text-sm ring-1"
                                >
                                    {{ report.comment }}
                                </p>
                            </div>
                        </div>
                    </UCard>
                </template>
            </UPageList>
        </template>
    </UDashboardPanel>
</template>
