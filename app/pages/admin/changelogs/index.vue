<script setup lang="ts">
const NuxtTime = resolveComponent('NuxtTime')

const { locale } = useI18n()

const rowSelection = ref<Record<string, boolean>>({})
const filter = ref(['hidden', 'unhidden', 'public', 'private'])
const searchQuery = ref('')

const { data, status, refresh } = await useFetch('/api/admin/changelogs', {
    dedupe: 'defer',
})

useSeo({
    title: 'Admin - Changelogs',
})
</script>

<template>
    <UDashboardPanel
        id="changelogs"
        :ui="{ body: 'gap-2 sm:gap-2 p-0 sm:p-0' }"
        class="max-w-[100qw]"
    >
        <template #header>
            <UDashboardNavbar title="Changelogs">
                <template #right>
                    <UButton
                        :to="$localePath('/admin/changelogs/compose')"
                        icon="mingcute:add-line"
                        label="New Changelog"
                        color="neutral"
                    />
                </template>
            </UDashboardNavbar>
        </template>

        <template #body>
            <AdminDataTable
                v-model:search-query="searchQuery"
                v-model:filter="filter"
                v-model:row-selection="rowSelection"
                :data
                :refresh
                :loading="status === 'pending'"
                :columns="[
                    {
                        accessorKey: 'slug',
                        header: '#',
                    },
                    {
                        accessorKey: 'title',
                        header: 'Title',
                    },
                    {
                        accessorKey: 'createdAt',
                        header: 'Created',
                        meta: { class: { td: 'text-xs leading-none font-mono' } },
                        cell: ({ row }) =>
                            h(NuxtTime, {
                                datetime: row.getValue('createdAt'),
                                dateStyle: 'short',
                                timeStyle: 'short',
                                locale,
                            }),
                    },
                    {
                        accessorKey: 'updatedAt',
                        header: 'Updated',
                        meta: { class: { td: 'text-xs leading-none font-mono' } },
                        cell: ({ row }) =>
                            h(NuxtTime, {
                                datetime: row.getValue('updatedAt'),
                                dateStyle: 'short',
                                timeStyle: 'short',
                                locale,
                            }),
                    },
                ]"
                class="max-h-[calc(99dvh-var(--ui-header-height))] grow"
            />
        </template>
    </UDashboardPanel>
</template>
