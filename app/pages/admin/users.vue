<script lang="ts" setup>
const NuxtTime = resolveComponent('NuxtTime')

const { locale } = useI18n()
const { unbanUser: unbanUserAction } = useAdmin()
const banUser = useBanUserModal()
const { badgeDefinitions } = useBadges()

const rowSelection = ref<Record<string, boolean>>({})
const filter = ref(['user', 'admin', 'unbanned'])
const searchQuery = ref('')

const { data, status, refresh } = await useFetch('/api/admin/user', {
    dedupe: 'defer',
    query: {
        searchValue: searchQuery,
        role: computed(() => {
            const hasUser = filter.value.includes('user')
            const hasAdmin = filter.value.includes('admin')
            if (hasUser && !hasAdmin) return 'user'
            else if (hasAdmin && !hasUser) return 'admin'
            return undefined
        }),
        banned: computed(() => {
            const hasBanned = filter.value.includes('banned')
            const hasUnbanned = filter.value.includes('unbanned')
            if (hasUnbanned && !hasBanned) return 'false'
            else if (hasBanned && !hasUnbanned) return 'true'
            return undefined
        }),
    },
})

const unbanUser = async (userId: string) => {
    await unbanUserAction({ userId, onSuccess: () => refresh() })
}

useSeo({
    title: 'Admin - Users',
})
</script>

<template>
    <UDashboardPanel id="users" :ui="{ body: 'gap-2 sm:gap-2 p-0 sm:p-0' }" class="max-w-[100qw]">
        <template #header>
            <UDashboardNavbar title="Users" />
        </template>

        <template #body>
            <AdminDataTable
                v-model:search-query="searchQuery"
                v-model:filter="filter"
                v-model:row-selection="rowSelection"
                :data
                :loading="status === 'pending'"
                :filter-options="[
                    { value: 'user', label: 'User', icon: 'mingcute:user-3-fill' },
                    { value: 'admin', label: 'Admin', icon: 'mingcute:shield-shape-fill' },
                    { value: 'unbanned', label: 'Unbanned', icon: 'mingcute:check-line' },
                    { value: 'banned', label: 'Banned', icon: 'mingcute:forbid-circle-fill' },
                ]"
                :refresh
                :get-row-context-menu-items="
                    (row) => [
                        [
                            {
                                to: `/@${row.original.username}`,
                                label: 'Profile',
                                icon: 'mingcute:user-3-fill',
                            },
                        ],
                        [
                            {
                                label: 'Badges',
                                icon: 'mingcute:medal-fill',
                                children: Object.entries(badgeDefinitions).map(([, def]) => ({
                                    label: def.label,
                                    icon: def.icon,
                                })),
                            },
                            {
                                label: 'Role',
                                icon: 'mingcute:shield-shape-fill',
                                children: [
                                    { label: 'User', icon: 'mingcute:user-3-fill' },
                                    { label: 'Admin', icon: 'mingcute:shield-shape-fill' },
                                ],
                            },
                            {
                                label: row.original.banned ? 'Unban' : 'Ban',
                                icon: row.original.banned
                                    ? 'mingcute:back-fill'
                                    : 'mingcute:forbid-circle-fill',
                                onSelect: () => {
                                    if (row.original.banned) unbanUser(row.original.id)
                                    else
                                        banUser.open({
                                            userId: row.original.id,
                                            name: row.original.name,
                                            image: row.original.image,
                                        })
                                },
                            },
                        ],
                    ]
                "
                :columns="[
                    { accessorKey: 'user', header: 'User' },
                    {
                        accessorKey: 'username',
                        header: '@',
                        meta: { class: { td: 'text-xs' } },
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
                    { accessorKey: 'badges', header: 'Badges' },
                    { accessorKey: 'role', header: 'Role' },
                    { accessorKey: 'banned', header: 'Banned' },
                ]"
                class="max-h-[calc(99dvh-var(--ui-header-height))] grow"
            >
                <template #user-cell="{ row }">
                    <ULink :to="`/@${row.original.username}`" class="flex items-center gap-2">
                        <UAvatar
                            :src="row.original.image || undefined"
                            alt=""
                            icon="mingcute:user-3-fill"
                            size="2xs"
                        />
                        <span class="underline underline-offset-4">
                            {{ row.original.name }}
                        </span>
                    </ULink>
                </template>

                <template #badges-cell="{ row }">
                    <UButton
                        v-if="row.original.badges.length"
                        :label="row.original.badges.length.toString()"
                        variant="soft"
                        size="xs"
                    />
                </template>
            </AdminDataTable>
        </template>
    </UDashboardPanel>
</template>
