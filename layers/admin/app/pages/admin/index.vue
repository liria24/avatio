<script lang="ts" setup>
const { getSummary } = useAdmin()
const { data: summary } = await getSummary()

const stats = ref([
    {
        title: 'Total Items',
        value: summary.value?.itemCount || 0,
        to: '/admin/items',
    },
    {
        title: 'Feedbacks',
        value: summary.value?.feedbackOpenCount || 0,
        to: '/admin/feedbacks',
    },
    {
        title: 'Reports',
        value: summary.value?.reportOpenCount || 0,
        to: '/admin/reports',
    },
])

useSeo({
    title: 'Admin Console',
})
</script>

<template>
    <UDashboardPanel id="index" :ui="{ body: 'flex flex-col gap-8' }">
        <template #header>
            <div class="mt-6 flex w-full items-center gap-2 px-6">
                <h1 class="text-toned font-mono text-3xl font-light">Admin Console</h1>
                <UButton
                    to="/admin/config"
                    icon="mingcute:flag-3-fill"
                    label="Flags"
                    variant="soft"
                    color="neutral"
                    size="sm"
                    class="ml-auto"
                />
            </div>
        </template>

        <template #body>
            <AdminInsights />

            <div class="flex flex-col gap-4">
                <h2 class="text-toned font-mono leading-none font-bold">Stats</h2>

                <UPageGrid class="gap-2 sm:gap-4 lg:grid-cols-4">
                    <UPageCard
                        v-for="(stat, index) in stats"
                        :key="index"
                        :title="stat.title"
                        :to="stat.to"
                        variant="soft"
                        :ui="{
                            container: 'gap-y-1.5',
                            wrapper: 'items-start',
                            leading:
                                'p-2.5 rounded-full bg-primary/10 ring ring-inset ring-primary/25 flex-col',
                            title: 'font-normal text-muted text-xs uppercase',
                        }"
                        class="rounded-lg"
                    >
                        <span class="text-highlighted ml-auto text-2xl font-semibold">
                            {{ stat.value }}
                        </span>
                    </UPageCard>
                </UPageGrid>
            </div>
        </template>
    </UDashboardPanel>
</template>
