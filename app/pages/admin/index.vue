<script lang="ts" setup>
import 'vue-data-ui/style.css'

const modalFlags = useModalFlagsModal()

const { data: items } = await useFetch('/api/admin/items', {
    dedupe: 'defer',
})
const { data: feedbacks } = await useFetch('/api/admin/feedbacks', {
    query: {
        status: 'open',
    },
    dedupe: 'defer',
})

const stats = ref([
    {
        title: 'Total Items',
        value: items.value?.length || 0,
        to: '/admin/items',
    },
    {
        title: 'Feedbacks',
        value: feedbacks.value?.length || 0,
        to: '/admin/feedbacks',
    },
])
</script>

<template>
    <UDashboardPanel id="index">
        <template #header>
            <div class="mt-6 flex w-full items-center gap-2 px-6">
                <h1 class="text-toned font-mono text-3xl font-light">Admin Console</h1>
                <UButton
                    icon="mingcute:flag-3-fill"
                    label="Flags"
                    variant="soft"
                    color="neutral"
                    size="sm"
                    class="ml-auto"
                    @click="modalFlags.open()"
                />
            </div>
        </template>

        <template #body>
            <UPageGrid class="gap-2 sm:gap-4 lg:grid-cols-4">
                <UPageCard
                    variant="subtle"
                    :ui="{
                        container: 'gap-y-1.5',
                        wrapper: 'items-start',
                        leading:
                            'p-2.5 rounded-full bg-primary/10 ring ring-inset ring-primary/25 flex-col',
                        title: 'font-normal text-muted text-xs uppercase flex items-center gap-1 w-full',
                        body: 'w-full',
                    }"
                    class="col-span-2 first:rounded-l-lg last:rounded-r-lg hover:z-1 lg:rounded-none"
                >
                    <AdminChartSetups />

                    <template #title>
                        <span>Active Setups</span>

                        <UButton
                            to="/admin/setups"
                            icon="mingcute:arrow-right-line"
                            variant="ghost"
                            size="xs"
                            class="ml-auto"
                        />
                    </template>
                </UPageCard>

                <UPageCard
                    variant="subtle"
                    :ui="{
                        container: 'gap-y-1.5',
                        wrapper: 'items-start',
                        leading:
                            'p-2.5 rounded-full bg-primary/10 ring ring-inset ring-primary/25 flex-col',
                        title: 'font-normal text-muted text-xs uppercase flex items-center gap-1 w-full',
                        body: 'w-full',
                    }"
                    class="col-span-2 first:rounded-l-lg last:rounded-r-lg hover:z-1 lg:rounded-none"
                >
                    <AdminChartUsers />

                    <template #title>
                        <span>Total Users</span>

                        <UButton
                            to="/admin/users"
                            icon="mingcute:arrow-right-line"
                            variant="ghost"
                            size="xs"
                            class="ml-auto"
                        />
                    </template>
                </UPageCard>

                <UPageCard
                    v-for="(stat, index) in stats"
                    :key="index"
                    :title="stat.title"
                    :to="stat.to"
                    variant="subtle"
                    :ui="{
                        container: 'gap-y-1.5',
                        wrapper: 'items-start',
                        leading:
                            'p-2.5 rounded-full bg-primary/10 ring ring-inset ring-primary/25 flex-col',
                        title: 'font-normal text-muted text-xs uppercase',
                    }"
                    class="first:rounded-l-lg last:rounded-r-lg hover:z-1 lg:rounded-none"
                >
                    <span class="text-highlighted ml-auto text-2xl font-semibold">
                        {{ stat.value }}
                    </span>
                </UPageCard>
            </UPageGrid>
        </template>
    </UDashboardPanel>
</template>
