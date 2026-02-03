<script lang="ts" setup>
import { LazyModalAdminBanUser } from '#components'

const { unbanUser: unbanUserAction } = useAdminActions()
const overlay = useOverlay()

const modalBan = overlay.create(LazyModalAdminBanUser)

const { data, refresh } = await useFetch('/api/admin/user', {
    dedupe: 'defer',
})

const unbanUser = async (userId: string) => {
    const success = await unbanUserAction(userId)
    if (success) refresh()
}
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
                <div
                    v-for="user in data?.users"
                    :key="user.id"
                    class="hover:bg-muted/50 flex items-center gap-3 rounded-md p-2"
                >
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
                        class="text-muted text-xs leading-none text-nowrap"
                    />
                    <p
                        v-if="user.updatedAt !== user.createdAt"
                        class="text-muted text-xs leading-none text-nowrap"
                    >
                        (
                        <NuxtTime :datetime="user.updatedAt" relative />
                        に更新)
                    </p>

                    <UDropdownMenu
                        :items="[
                            [
                                {
                                    label: 'プロフィール',
                                    icon: 'mingcute:user-3-fill',
                                    onSelect: () => navigateTo(`/@${user.id}`),
                                },
                            ],
                            [
                                {
                                    label: 'ロール',
                                    icon: 'mingcute:shield-shape-fill',
                                    children: [
                                        {
                                            label: 'ユーザー',
                                            icon: 'mingcute:user-3-fill',
                                        },
                                        {
                                            label: '管理者',
                                            icon: 'mingcute:shield-shape-fill',
                                        },
                                    ],
                                },
                                {
                                    label: user.banned ? 'BAN 解除' : 'BAN',
                                    icon: user.banned
                                        ? 'mingcute:back-fill'
                                        : 'mingcute:forbid-circle-fill',
                                    onSelect: () => {
                                        if (user.banned) unbanUser(user.id)
                                        else
                                            modalBan.open({
                                                userId: user.id,
                                                name: user.name,
                                                image: user.image,
                                            })
                                    },
                                },
                            ],
                        ]"
                    >
                        <UButton icon="mingcute:more-2-line" variant="ghost" size="sm" />
                    </UDropdownMenu>
                </div>
            </UPageList>
        </template>
    </UDashboardPanel>
</template>
