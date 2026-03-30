<script lang="ts" setup>
const { locale, t } = useI18n()
const { unbanUser: unbanUserAction } = useAdminActions()
const banUser = useBanUserModal()
const { badgeDefinitions } = useBadges()

const { data, refresh } = await useFetch('/api/admin/user', {
    dedupe: 'defer',
})

const unbanUser = async (userId: string) => {
    const success = await unbanUserAction(userId)
    if (success) refresh()
}

const getMenuItems = (user: NonNullable<typeof data.value>[number]) => [
    [
        {
            to: `/@${user.username}`,
            label: t('admin.users.profile'),
            icon: 'mingcute:user-3-fill',
        },
    ],
    [
        {
            label: 'バッジ',
            icon: 'mingcute:medal-fill',
            children: Object.entries(badgeDefinitions.value).map(([, def]) => ({
                label: def.label,
                icon: def.icon,
            })),
        },
        {
            label: t('admin.users.role'),
            icon: 'mingcute:shield-shape-fill',
            children: [
                {
                    label: t('admin.users.roleUser'),
                    icon: 'mingcute:user-3-fill',
                },
                {
                    label: t('admin.users.roleAdmin'),
                    icon: 'mingcute:shield-shape-fill',
                },
            ],
        },
        {
            label: user.banned ? t('admin.users.unban') : t('admin.users.ban'),
            icon: user.banned ? 'mingcute:back-fill' : 'mingcute:forbid-circle-fill',
            onSelect: () => {
                if (user.banned) unbanUser(user.id)
                else
                    banUser.open({
                        userId: user.id,
                        name: user.name,
                        image: user.image,
                    })
            },
        },
    ],
]
</script>

<template>
    <UDashboardPanel id="users">
        <template #header>
            <UDashboardNavbar title="Users">
                <template #trailing>
                    <UButton
                        loading-auto
                        icon="mingcute:refresh-2-line"
                        variant="ghost"
                        size="sm"
                        @click="refresh()"
                    />
                </template>

                <template #right>
                    <USelect
                        :items="[
                            {
                                label: 'All',
                                icon: 'mingcute:filter-fill',
                                value: 'all',
                            },
                            {
                                label: 'Admin',
                                icon: 'mingcute:shield-shape-fill',
                                value: 'admin',
                            },
                            {
                                label: 'Banned',
                                icon: 'mingcute:forbid-circle-fill',
                                value: 'banned',
                            },
                        ]"
                        default-value="all"
                        disabled
                        class="min-w-32"
                    />
                </template>
            </UDashboardNavbar>
        </template>

        <template #body>
            <UPageList divide>
                <UContextMenu v-for="user in data" :key="user.id" :items="getMenuItems(user)">
                    <div class="hover:bg-muted/50 flex items-center gap-3 rounded-md p-2">
                        <UAvatar
                            :src="user.image || undefined"
                            alt=""
                            icon="mingcute:user-3-fill"
                            size="xs"
                        />

                        <div class="flex grow items-center gap-2">
                            <p class="text-muted line-clamp-1 text-sm leading-none break-all">
                                {{ user.name }}
                            </p>
                            <UBadge
                                v-if="user.role === 'admin'"
                                label="admin"
                                variant="subtle"
                                size="sm"
                            />
                            <UBadge
                                v-if="user.banned"
                                label="BANNED"
                                variant="subtle"
                                color="error"
                                size="sm"
                            />
                        </div>

                        <NuxtTime
                            :datetime="user.createdAt"
                            relative
                            :locale
                            class="text-muted text-xs leading-none text-nowrap"
                        />
                        <UTooltip v-if="user.updatedAt !== user.createdAt" :delay-duration="100">
                            <Icon name="mingcute:edit-3-fill" size="16" class="text-muted" />

                            <template #content>
                                <NuxtTime :datetime="user.updatedAt" relative :locale />
                            </template>
                        </UTooltip>

                        <UDropdownMenu :items="getMenuItems(user)">
                            <UButton icon="mingcute:more-2-line" variant="ghost" size="sm" />
                        </UDropdownMenu>
                    </div>
                </UContextMenu>
            </UPageList>
        </template>
    </UDashboardPanel>
</template>
