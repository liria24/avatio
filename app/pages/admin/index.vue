<script lang="ts" setup>
import { LazyModalAdminModalFlags } from '#components'

definePageMeta({
    middleware: 'admin',
    layout: 'dashboard',
})

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
    getCachedData: (key, n, ctx) =>
        ctx.cause !== 'refresh:manual' && n.isHydrating ? n.payload.data[key] : n.static.data[key],
})

const stats = ref([
    {
        title: 'Total Users',
        value: data.value.users,
        icon: 'lucide:users-round',
        to: '/admin/users',
    },
    {
        title: 'Active Setups',
        value: data.value.setups,
        icon: 'lucide:sparkles',
        to: '/admin/setups',
    },
    {
        title: 'Total Items',
        value: data.value.items,
        icon: 'lucide:package',
        to: '/admin/items',
    },
    {
        title: 'Feedbacks',
        value: data.value.feedbacks,
        icon: 'lucide:message-square',
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
                        icon="lucide:flag"
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
