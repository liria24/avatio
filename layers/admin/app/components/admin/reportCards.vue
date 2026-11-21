<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { InternalApi } from 'nitropack/types'

type UserReport = InternalApi['/api/admin/reports/user']['get']['data'][number]
type SetupReport = InternalApi['/api/admin/reports/setup']['get']['data'][number]
type ItemReport = InternalApi['/api/admin/reports/item']['get']['data'][number]

defineProps<{
    tab: 'user' | 'setup' | 'item'
    userReports: UserReport[]
    setupReports: SetupReport[]
    itemReports: ItemReport[]
    userActions: (report: UserReport) => DropdownMenuItem[][]
    setupActions: (report: SetupReport) => DropdownMenuItem[][]
    itemActions: (report: ItemReport) => DropdownMenuItem[][]
}>()

const emit = defineEmits<{
    resolve: [id: number, isResolved: boolean]
}>()

const reasonLabels = {
    user: {
        spam: 'admin.reports.user.reasons.spam',
        hate: 'admin.reports.user.reasons.malicious',
        infringe: 'admin.reports.user.reasons.infringement',
        badImage: 'admin.reports.user.reasons.inappropriate',
        other: 'admin.reports.user.reasons.other',
    },
    setup: {
        spam: 'admin.reports.setup.reasons.spam',
        hate: 'admin.reports.setup.reasons.hate',
        infringe: 'admin.reports.setup.reasons.infringement',
        badImage: 'admin.reports.setup.reasons.extreme',
        other: 'admin.reports.setup.reasons.other',
    },
    item: {
        nameError: 'admin.reports.item.reasons.wrongName',
        irrelevant: 'admin.reports.item.reasons.unrelated',
        other: 'admin.reports.item.reasons.other',
    },
} as const

const getReasonLabels = (report: object, map: Record<string, string>): string[] =>
    Object.entries(map).flatMap(([key, label]) => (Reflect.get(report, key) ? [label] : []))

const itemCategory = useItemCategory()
const setupPath = useSetupPath()
</script>

<template>
    <UPageList class="gap-4">
        <template v-if="tab === 'user'">
            <UCard v-for="report in userReports" :key="report.id">
                <template #header>
                    <AdminReportHeader
                        :id="report.id"
                        :is-resolved="report.isResolved"
                        :created-at="report.createdAt"
                        :reporter="report.reporter"
                        :actions="userActions(report)"
                        @resolve="(id, isResolved) => emit('resolve', id, isResolved)"
                    />
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

                    <AdminReportReasons
                        :labels="getReasonLabels(report, reasonLabels.user)"
                        :comment="report.comment"
                    />
                </div>
            </UCard>
        </template>

        <template v-else-if="tab === 'setup'">
            <UCard v-for="report in setupReports" :key="report.id">
                <template #header>
                    <AdminReportHeader
                        :id="report.id"
                        :is-resolved="report.isResolved"
                        :created-at="report.createdAt"
                        :reporter="report.reporter"
                        :actions="setupActions(report)"
                        @resolve="(id, isResolved) => emit('resolve', id, isResolved)"
                    />
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

                    <AdminReportReasons
                        :labels="getReasonLabels(report, reasonLabels.setup)"
                        :comment="report.comment"
                    />
                </div>
            </UCard>
        </template>

        <template v-else>
            <UCard v-for="report in itemReports" :key="report.id">
                <template #header>
                    <AdminReportHeader
                        :id="report.id"
                        :is-resolved="report.isResolved"
                        :created-at="report.createdAt"
                        :reporter="report.reporter"
                        :actions="itemActions(report)"
                        @resolve="(id, isResolved) => emit('resolve', id, isResolved)"
                    />
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
                                <p class="text-sm leading-tight font-medium break-words">
                                    {{ report.item.displayNameOverride || report.item.name }}
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
                                                report.item.category as keyof typeof itemCategory
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

                    <AdminReportReasons
                        :labels="getReasonLabels(report, reasonLabels.item)"
                        :comment="report.comment"
                    />
                </div>
            </UCard>
        </template>
    </UPageList>
</template>
