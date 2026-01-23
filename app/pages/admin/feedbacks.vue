<script lang="ts" setup>
const toast = useToast()

const { data, refresh } = await useFetch('/api/feedbacks', {
    dedupe: 'defer',
})

const closeFeedback = async (feedbackId: number) => {
    try {
        await $fetch(`/api/feedbacks/${feedbackId}`, {
            method: 'PATCH',
            body: {
                isClosed: true,
            },
        })
        toast.add({
            title: 'フィードバックをクローズしました',
            color: 'success',
        })
    } catch (error) {
        console.error('Failed to close feedback:', error)
        toast.add({
            title: 'フィードバックのクローズに失敗しました',
            color: 'error',
        })
    } finally {
        refresh()
    }
}

const openFeedback = async (feedbackId: number) => {
    try {
        await $fetch(`/api/feedbacks/${feedbackId}`, {
            method: 'PATCH',
            body: {
                isClosed: false,
            },
        })
        toast.add({
            title: 'フィードバックをオープンしました',
            color: 'success',
        })
    } catch (error) {
        console.error('Failed to open feedback:', error)
        toast.add({
            title: 'フィードバックのオープンに失敗しました',
            color: 'error',
        })
    } finally {
        refresh()
    }
}
</script>

<template>
    <UDashboardPanel id="feedbacks">
        <template #header>
            <UDashboardNavbar title="Feedbacks">
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
                </template>
            </UDashboardNavbar>
        </template>

        <template #body>
            <div v-if="!data?.length">
                <p class="text-muted text-center text-sm">フィードバックはありません。</p>
            </div>

            <div v-else class="flex max-h-96 flex-col gap-2 overflow-y-auto p-1">
                <div
                    v-for="feedback in data"
                    :key="feedback.id"
                    class="bg-muted flex flex-col gap-2 rounded-lg p-3"
                >
                    <div class="flex items-center gap-2">
                        <div class="flex grow items-center gap-2">
                            <p class="text-muted text-xs leading-none text-nowrap">
                                {{ feedback.fingerprint }}
                            </p>
                            <p class="text-muted text-xs leading-none text-nowrap">
                                {{ feedback.contextPath }}
                            </p>
                        </div>

                        <NuxtTime
                            :datetime="feedback.createdAt"
                            relative
                            class="text-muted text-xs leading-none text-nowrap"
                        />
                        <UBadge
                            v-if="feedback.isClosed"
                            label="CLOSED"
                            variant="subtle"
                            color="success"
                            size="sm"
                        />
                        <UDropdownMenu
                            :items="[
                                {
                                    icon: feedback.isClosed
                                        ? 'lucide:circle-dot'
                                        : 'lucide:circle-slash',
                                    label: feedback.isClosed ? 'オープン' : 'クローズ',
                                    onSelect: () => {
                                        if (feedback.isClosed) openFeedback(feedback.id)
                                        else closeFeedback(feedback.id)
                                    },
                                },
                            ]"
                        >
                            <UButton icon="lucide:menu" variant="ghost" size="xs" />
                        </UDropdownMenu>
                    </div>
                    <p class="text-toned text-sm">{{ feedback.comment }}</p>
                </div>
            </div>
        </template>
    </UDashboardPanel>
</template>
