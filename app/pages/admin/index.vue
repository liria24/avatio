<script lang="ts" setup>
import { LazyModalAdminModalFlags } from '#components'

const overlay = useOverlay()

const modalFlags = overlay.create(LazyModalAdminModalFlags)

const { data } = await useFetch('/api/admin/stats', {
    dedupe: 'defer',
    default: () => ({
        users: 0,
        setups: 0,
        items: 0,
        feedbacks: 0,
    }),
})

const stats = ref([
    {
        title: 'Total Users',
        value: data.value.users,
        icon: 'mingcute:group-2-fill',
        to: '/admin/users',
    },
    {
        title: 'Active Setups',
        value: data.value.setups,
        icon: 'mingcute:sparkles-fill',
        to: '/admin/setups',
    },
    {
        title: 'Total Items',
        value: data.value.items,
        icon: 'mingcute:package-2-fill',
        to: '/admin/items',
    },
    {
        title: 'Feedbacks',
        value: data.value.feedbacks,
        icon: 'mingcute:chat-3-fill',
        to: '/admin/feedbacks',
    },
])
</script>

<template>
    <UDashboardPanel id="index">
        <template #header>
            <UDashboardNavbar title="Admin Console">
                <template #right>
                    <UButton
                        icon="mingcute:flag-3-fill"
                        label="Flags"
                        variant="subtle"
                        color="neutral"
                        @click="modalFlags.open()"
                    />
                </template>
            </UDashboardNavbar>
        </template>

        <template #body>
            <UPageGrid class="gap-2 sm:gap-4 lg:grid-cols-4">
                <UPageCard
                    v-for="(stat, index) in stats"
                    :key="index"
                    :icon="stat.icon"
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
                    <div class="flex items-center gap-2">
                        <span class="text-highlighted text-2xl font-semibold">
                            {{ stat.value }}
                        </span>
                    </div>
                </UPageCard>
            </UPageGrid>
        </template>
    </UDashboardPanel>
</template>
