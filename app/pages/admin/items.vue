<script setup lang="ts">
const NuxtTime = resolveComponent('NuxtTime')

const { locale } = useI18n()

const rowSelection = ref<Record<string, boolean>>({})
const filter = ref(['available', 'withdrawn', 'policy_rejected', 'unknown'])
const searchQuery = ref('')

const queryParams = computed(() => ({
    q: searchQuery.value || undefined,
    availability: filter.value.length ? filter.value : undefined,
}))

const { data, status, refresh } = await useFetch('/api/admin/items', {
    dedupe: 'defer',
    query: queryParams,
})

useSeo({
    title: 'Admin - Items',
})
</script>

<template>
    <UDashboardPanel id="items" :ui="{ body: 'gap-2 sm:gap-2 p-0 sm:p-0' }" class="max-w-[100qw]">
        <template #header>
            <UDashboardNavbar title="Items" />
        </template>

        <template #body>
            <AdminDataTable
                v-model:search-query="searchQuery"
                v-model:filter="filter"
                v-model:row-selection="rowSelection"
                :data
                :refresh
                :loading="status === 'pending'"
                :filter-options="[
                    { value: 'available', label: 'Available', icon: 'mingcute:check-line' },
                    { value: 'withdrawn', label: 'Withdrawn', icon: 'mingcute:forbid-circle-fill' },
                    { value: 'policy_rejected', label: 'Policy rejected' },
                    { value: 'unknown', label: 'Unknown' },
                ]"
                :columns="[
                    {
                        accessorKey: 'item',
                        header: 'Item',
                        meta: { class: { td: 'max-w-sm' } },
                    },
                    { accessorKey: 'displayNameOverride', header: 'Display Name' },
                    { accessorKey: 'primarySource.providerKey', header: 'Provider' },
                    {
                        accessorKey: 'createdAt',
                        header: 'Added',
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
                    { accessorKey: 'primarySource.availability', header: 'Availability' },
                ]"
                class="max-h-[calc(99dvh-var(--ui-header-height))] grow"
            >
                <template #item-cell="{ row }">
                    <ULink class="flex max-w-sm items-center gap-2 overflow-clip">
                        <UAvatar
                            :src="row.original.image || undefined"
                            alt=""
                            :icon="
                                getCatalogProviderData(row.original.primarySource?.providerKey)
                                    ?.icon || 'mingcute:question-line'
                            "
                            size="2xs"
                            :ui="{ image: 'rounded-md' }"
                            class="rounded-md"
                        />
                        <span class="break-all underline underline-offset-4">
                            {{ row.original.name }}
                        </span>
                    </ULink>
                </template>
            </AdminDataTable>
        </template>
    </UDashboardPanel>
</template>
