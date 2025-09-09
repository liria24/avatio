<script setup lang="ts">
definePageMeta({
    middleware: 'admin',
    layout: 'dashboard',
})

const toast = useToast()

const { data, status, refresh } = await useFetch('/api/reports/setup', {
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
        ctx.cause !== 'initial'
            ? undefined
            : nuxtApp.payload.data[key] || nuxtApp.static.data[key],
})

const resolve = async (id: number, resolve?: boolean) => {
    try {
        const isResolved = resolve ?? true
        await $fetch(`/api/reports/setup/${id}`, {
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
    <UDashboardPanel id="reports-setup">
        <template #header>
            <UDashboardNavbar title="Reports | Setup">
                <template #right>
                    <USelect
                        :items="[
                            {
                                label: 'All',
                                icon: 'lucide:filter',
                                value: 'all',
                            },
                            {
                                label: 'Open',
                                icon: 'lucide:circle-dot',
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
                        icon="lucide:refresh-cw"
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
                                        : 'lucide:circle-dot'
                                "
                                :color="
                                    report.isResolved ? 'neutral' : 'success'
                                "
                                variant="outline"
                                class="rounded-full py-1.5 pr-3 pl-2.5"
                            />
                            <NuxtTime
                                :datetime="report.createdAt"
                                relative
                                class="text-muted text-xs"
                            />

                            <div
                                class="flex grow items-center justify-end gap-2"
                            >
                                <UUser
                                    :avatar="{
                                        src: report.reporter.image,
                                        alt: report.reporter.name,
                                        icon: 'lucide:user-round',
                                    }"
                                    :name="report.reporter.name"
                                    size="sm"
                                    class="mr-2"
                                />

                                <UButton
                                    v-if="report.isResolved"
                                    loading-auto
                                    icon="lucide:x"
                                    label="Mark as Unresolved"
                                    color="neutral"
                                    variant="subtle"
                                    size="sm"
                                    @click="resolve(report.id, false)"
                                />
                                <UButton
                                    v-else
                                    loading-auto
                                    icon="lucide:check"
                                    label="Mark as Resolved"
                                    color="neutral"
                                    size="sm"
                                    @click="resolve(report.id)"
                                />
                            </div>
                        </div>
                    </template>

                    <div
                        class="grid w-full grid-cols-1 items-start gap-4 sm:grid-cols-2"
                    >
                        <UPageCard
                            :to="`/setup/${report.setup.id}`"
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
                                    label="スパム、個人情報、不適切な内容"
                                    variant="outline"
                                    class="rounded-full px-2"
                                />
                                <UBadge
                                    v-if="report.hate"
                                    label="差別、暴力、誹謗中傷"
                                    variant="outline"
                                    class="rounded-full px-2"
                                />
                                <UBadge
                                    v-if="report.infringe"
                                    label="他者への権利侵害"
                                    variant="outline"
                                    class="rounded-full px-2"
                                />
                                <UBadge
                                    v-if="report.badImage"
                                    label="過激な画像"
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
