<script setup lang="ts">
const NuxtTime = resolveComponent('NuxtTime')

const { locale } = useI18n()
const setupHide = useSetupHideModal()
const setupUnhide = useSetupUnhideModal()
const modalImageViewer = useImageViewerModal()

const rowSelection = ref<Record<string, boolean>>({})
const filter = ref(['hidden', 'unhidden', 'public', 'private'])
const searchQuery = ref('')

const { data, status, refresh } = await useFetch('/api/admin/setups', {
    dedupe: 'defer',
    query: {
        q: searchQuery,
        hidden: computed(() => {
            const hasHidden = filter.value.includes('hidden')
            const hasUnhidden = filter.value.includes('unhidden')
            if (hasHidden && !hasUnhidden) return 'true'
            else if (hasUnhidden && !hasHidden) return 'false'
            return undefined
        }),
        private: computed(() => {
            const hasPrivate = filter.value.includes('private')
            const hasPublic = filter.value.includes('public')
            if (hasPrivate && !hasPublic) return 'true'
            else if (hasPublic && !hasPrivate) return 'false'
            return undefined
        }),
    },
})

useSeo({
    title: 'Admin - Setups',
})
</script>

<template>
    <UDashboardPanel id="setups" :ui="{ body: 'gap-2 sm:gap-2 p-0 sm:p-0' }" class="max-w-[100qw]">
        <template #header>
            <UDashboardNavbar title="Setups" />
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
                    { value: 'hidden', label: 'Hidden', icon: 'mingcute:eye-close-line' },
                    { value: 'unhidden', label: 'Unhidden', icon: 'mingcute:eye-fill' },
                    { value: 'public', label: 'Public', icon: 'mingcute:earth-2-fill' },
                    { value: 'private', label: 'Private', icon: 'mingcute:lock-fill' },
                ]"
                :get-row-context-menu-items="
                    (row) => [
                        [
                            {
                                to: `/setup/${row.original.id}`,
                                label: 'View',
                                icon: 'mingcute:sparkles-fill',
                            },
                        ],
                        [
                            {
                                label: row.original.hidAt ? 'Unhide' : 'Hide',
                                icon: row.original.hidAt
                                    ? 'mingcute:eye-fill'
                                    : 'mingcute:eye-close-line',
                                onSelect: async () => {
                                    if (row.original.hidAt)
                                        setupUnhide.open({ setupId: row.original.id })
                                    else setupHide.open({ setupId: row.original.id })
                                    refresh()
                                },
                            },
                        ],
                    ]
                "
                :columns="[
                    {
                        accessorKey: 'name',
                        header: 'Setup',
                        meta: { class: { td: 'max-w-sm' } },
                    },
                    { accessorKey: 'images', header: 'Images' },
                    { accessorKey: 'user', header: 'User' },
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
                    { accessorKey: 'hidAt', header: 'Hidden' },
                ]"
                class="max-h-[calc(99dvh-var(--ui-header-height))] grow"
            >
                <template #name-cell="{ row }">
                    <ULink :to="`/setup/${row.original.id}`" class="flex w-fit items-center gap-1">
                        <span class="underline underline-offset-4">
                            {{ row.original.name }}
                        </span>
                        <Icon
                            v-if="row.original.public === false"
                            name="mingcute:lock-fill"
                            size="14"
                            class="shrink-0"
                        />
                    </ULink>
                </template>

                <template #images-cell="{ row }">
                    <div class="flex items-center gap-1">
                        <NuxtImg
                            v-for="(image, index) in row.original.images"
                            :key="index"
                            :src="image.url"
                            alt=""
                            width="32"
                            height="32"
                            class="aspect-square size-8 cursor-pointer rounded-md object-cover"
                            @click="modalImageViewer.open({ src: image.url })"
                        />
                    </div>
                </template>

                <template #user-cell="{ row }">
                    <ULink
                        :to="`/@${row.original.user.username}`"
                        class="flex w-fit items-center gap-2"
                    >
                        <UAvatar
                            :src="row.original.user.image || undefined"
                            alt=""
                            icon="mingcute:user-3-fill"
                            size="2xs"
                        />
                        <span class="underline underline-offset-4">
                            {{ row.original.user.name }}
                        </span>
                    </ULink>
                </template>
            </AdminDataTable>
        </template>
    </UDashboardPanel>
</template>
