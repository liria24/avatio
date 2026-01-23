<script setup lang="ts">
import { LazyModalAdminChangeItemNiceName } from '#components'

const { itemCategory } = useAppConfig()
const toast = useToast()
const overlay = useOverlay()

const modalChangeItemNiceName = overlay.create(LazyModalAdminChangeItemNiceName)

const { data, status, refresh } = await useFetch('/api/reports/item', {
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
        await $fetch(`/api/reports/item/${id}`, {
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
    <UDashboardPanel id="reports-item">
        <template #header>
            <UDashboardNavbar title="Reports | Item">
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
                                    label="Change Nice Name"
                                    variant="outline"
                                    color="neutral"
                                    size="sm"
                                    @click="
                                        modalChangeItemNiceName.open({
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
                                            :label="itemCategory[report.item.category].label"
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
                                    label="アイテム名称の誤り"
                                    variant="outline"
                                    class="rounded-full px-2"
                                />
                                <UBadge
                                    v-if="report.irrelevant"
                                    label="無関係なアイテム"
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
