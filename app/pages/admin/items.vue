<script setup lang="ts">
const NuxtTime = resolveComponent('NuxtTime')

const { locale } = useI18n()

const rowSelection = ref<Record<string, boolean>>({})
const filter = ref(['available', 'outdated'])
const searchQuery = ref('')

const queryParams = computed(() => {
    const params: Record<string, string> = {}

    const hasAvailable = filter.value.includes('available')
    const hasOutdated = filter.value.includes('outdated')
    if (hasAvailable && !hasOutdated) params.outdated = 'false'
    else if (hasOutdated && !hasAvailable) params.outdated = 'true'

    if (searchQuery.value) params.q = searchQuery.value

    return params
})

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
                    { value: 'outdated', label: 'Outdated', icon: 'mingcute:forbid-circle-fill' },
                ]"
                :columns="[
                    {
                        accessorKey: 'item',
                        header: 'Item',
                        meta: { class: { td: 'max-w-sm' } },
                    },
                    { accessorKey: 'niceName', header: 'Nice Name' },
                    { accessorKey: 'platform', header: 'Platform' },
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
                    { accessorKey: 'outdated', header: 'Outdated' },
                ]"
                class="max-h-[calc(99dvh-var(--ui-header-height))] grow"
            >
                <template #item-cell="{ row }">
                    <ULink class="flex max-w-sm items-center gap-2 overflow-clip">
                        <UAvatar
                            :src="row.original.image || undefined"
                            alt=""
                            :icon="
                                getPlatformData(row.original.platform)?.icon ||
                                'mingcute:question-line'
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
