<script setup lang="ts">
const toast = useToast()

const { data, status, refresh } = await useFetch('/api/reports/user', {
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
    getCachedData: (key, nuxtApp, ctx) =>
        ctx.cause !== 'initial' ? undefined : nuxtApp.payload.data[key] || nuxtApp.static.data[key],
})

const resolve = async (id: number, resolve?: boolean) => {
    try {
        const isResolved = resolve ?? true
        await $fetch(`/api/reports/user/${id}`, {
            method: 'PATCH',
            body: { isResolved },
        })
        toast.add({
            title: isResolved ? 'Marked as Resolved' : 'Marked as Unresolved',
            color: 'success',
        })
    } catch (error) {
        console.error('Error:', error)
        toast.add({
            title: 'Error',
            color: 'error',
        })
    } finally {
        refresh()
    }
}
</script>

<template>
    <UDashboardPanel id="reports-user">
        <template #header>
            <UDashboardNavbar title="Reports | User">
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

                    <UButton
                        :loading="status === 'pending'"
                        icon="mingcute:refresh-2-fill"
                        variant="soft"
                        color="neutral"
                        @click="refresh()"
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
                            :to="`/@${report.reportee.id}`"
                            target="_blank"
                            :ui="{ container: 'p-2 sm:p-2' }"
                        >
                            <UUser
                                :name="report.reportee.name"
                                :description="`@${report.reportee.id}`"
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
                                    label="スパム"
                                    variant="outline"
                                    class="rounded-full px-2"
                                />
                                <UBadge
                                    v-if="report.hate"
                                    label="悪意のあるユーザー"
                                    variant="outline"
                                    class="rounded-full px-2"
                                />
                                <UBadge
                                    v-if="report.infringe"
                                    label="権利侵害"
                                    variant="outline"
                                    class="rounded-full px-2"
                                />
                                <UBadge
                                    v-if="report.badImage"
                                    label="不適切な画像"
                                    variant="outline"
                                    class="rounded-full px-2"
                                />
                                <UBadge
                                    v-if="report.other"
                                    label="その他"
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
