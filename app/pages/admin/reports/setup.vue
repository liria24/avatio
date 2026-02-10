<script setup lang="ts">
const { locale } = useI18n()
const { resolveReport } = useAdminActions()

const { data, refresh } = await useFetch('/api/admin/reports/setup', {
    dedupe: 'defer',
    default: () => ({
        data: [],
        pagination: {
            page: 1,
            limit: 0,
            total: 0,
            totalPages: 0,
            hasPrev: false,
            hasNext: false,
        },
    }),
})

const resolve = async (id: number, resolve?: boolean) => {
    const success = await resolveReport('setup', id, resolve ?? true)
    if (success) refresh()
}
</script>

<template>
    <UDashboardPanel id="reports-setup">
        <template #header>
            <UDashboardNavbar title="Reports | Setup">
                <template #trailing>
                    <UButton
                        loading-auto
                        icon="mingcute:refresh-2-line"
                        variant="ghost"
                        size="sm"
                        @click="refresh()"
                    />
                </template>

                <template #right>
                    <USelect
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
                        default-value="all"
                        disabled
                        class="min-w-32"
                    />
                </template>
            </UDashboardNavbar>
        </template>

        <template #body>
            <UPageList class="gap-4">
                <UCard v-for="report in data.data" :key="report.id">
                    <template #header>
                        <div class="flex w-full items-center gap-2">
                            <span class="text-muted text-lg leading-none font-light text-nowrap">
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
            </UPageList>
        </template>
    </UDashboardPanel>
</template>
