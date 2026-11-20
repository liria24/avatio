<script lang="ts" setup>
const { closeFeedback: closeFeedbackAction, openFeedback: openFeedbackAction } = useAdmin()

const filter = ref(['open'])

const queryParams = computed(() => {
    const params: Record<string, string> = {}

    const hasOpen = filter.value.includes('open')
    const hasClosed = filter.value.includes('closed')
    if (hasOpen && !hasClosed) params.status = 'open'
    else if (hasClosed && !hasOpen) params.status = 'closed'
    else params.status = 'all'

    return params
})

const { data, refresh } = await useFetch('/api/admin/feedbacks', {
    dedupe: 'defer',
    query: queryParams,
})

const closeFeedback = async (feedbackId: number) => {
    await closeFeedbackAction({ feedbackId, onSuccess: () => refresh() })
}

const openFeedback = async (feedbackId: number) => {
    await openFeedbackAction({ feedbackId, onSuccess: () => refresh() })
}

useSeo({
    title: 'Admin - Feedbacks',
})
</script>

<template>
    <UDashboardPanel
        id="feedbacks"
        :ui="{
            body: 'gap-4 sm:gap-4 p-3 sm:p-5 max-h-[calc(99dvh-var(--ui-header-height))]',
        }"
    >
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
            </UDashboardNavbar>
        </template>

        <template #body>
            <div class="flex items-center gap-1">
                <USelect
                    v-model="filter"
                    :items="[
                        {
                            value: 'open',
                            label: 'Open',
                            icon: 'lucide:circle-dot',
                        },
                        {
                            value: 'closed',
                            label: 'Closed',
                            icon: 'lucide:circle-slash',
                        },
                    ]"
                    multiple
                    placeholder="Filter"
                    icon="mingcute:filter-fill"
                    size="sm"
                    class="min-w-32 rounded-lg"
                />
            </div>

            <USeparator />

            <div v-if="!data?.length">
                <p class="text-muted text-center text-sm">{{ $t('admin.feedbacks.empty') }}</p>
            </div>

            <div v-else class="flex flex-col gap-4">
                <div
                    v-for="feedback in data"
                    :key="feedback.id"
                    class="text-muted flex flex-col gap-1 text-xs"
                >
                    <div class="flex items-center gap-1">
                        <Icon
                            v-if="feedback.isClosed"
                            name="lucide:circle-slash"
                            size="18"
                            class="m-0.75 text-purple-400"
                        />
                        <Icon
                            v-else
                            name="lucide:circle-dot"
                            size="18"
                            class="text-success m-0.75"
                        />

                        <NuxtTime
                            :datetime="feedback.createdAt"
                            relative
                            locale="en"
                            class="leading-none text-nowrap"
                        />

                        <span class="ml-auto font-mono leading-none text-nowrap">
                            {{ feedback.contextPath }}
                        </span>

                        <Icon name="lucide:dot" size="14" class="text-dimmed" />

                        <span class="font-mono">
                            {{ feedback.fingerprint.slice(0, 8) }}
                        </span>

                        <UDropdownMenu
                            :items="[
                                {
                                    icon: feedback.isClosed
                                        ? 'lucide:circle-dot'
                                        : 'lucide:circle-slash',
                                    label: feedback.isClosed
                                        ? $t('admin.feedbacks.open')
                                        : $t('admin.feedbacks.close'),
                                    onSelect: () => {
                                        if (feedback.isClosed) openFeedback(feedback.id)
                                        else closeFeedback(feedback.id)
                                    },
                                },
                            ]"
                        >
                            <UButton icon="mingcute:more-2-line" variant="ghost" size="xs" />
                        </UDropdownMenu>
                    </div>

                    <p
                        class="ring-muted text-toned grow rounded-xl p-3 whitespace-pre-wrap ring-1 ring-inset"
                    >
                        {{ feedback.comment }}
                    </p>
                </div>
            </div>
        </template>
    </UDashboardPanel>
</template>
