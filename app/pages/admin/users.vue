<script lang="ts" setup>
import { LazyModalAdminBanUser } from '#components'

const toast = useToast()
const overlay = useOverlay()

const modalBan = overlay.create(LazyModalAdminBanUser)

const { data, status, refresh } = await useFetch('/api/admin/user', {
    dedupe: 'defer',
    getCachedData: (key, nuxtApp, ctx) =>
        ctx.cause !== 'initial' ? undefined : nuxtApp.payload.data[key] || nuxtApp.static.data[key],
})

const unbanUser = async (userId: string) => {
    try {
        await $fetch(`/api/admin/user/${userId}`, {
            method: 'PATCH',
            body: {
                ban: false,
            },
        })
        toast.add({
            title: 'ユーザーのBANを解除しました',
            color: 'success',
        })
    } catch (error) {
        console.error('Failed to unban user:', error)
        toast.add({
            title: 'ユーザーのBAN解除に失敗しました',
            color: 'error',
        })
    } finally {
        refresh()
    }
}
</script>

<template>
    <UDashboardPanel id="users">
        <template #header>
            <UDashboardNavbar title="Users">
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

                    <UButton
                        :loading="status === 'pending'"
                        icon="mingcute:refresh-2-fill"
                        variant="soft"
                        color="neutral"
                        @click="refresh()"
                    />
                </template>
            </UDashboardNavbar>
        </template>

        <template #body>
            <UPageList divide>
                <div v-for="user in data?.users" :key="user.id" class="flex items-center gap-3 p-2">
                    <UAvatar :src="user.image || undefined" size="xs" />

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
                        <UButton icon="mingcute:menu-fill" variant="soft" size="sm" />
                    </UDropdownMenu>
                </div>
            </UPageList>
        </template>
    </UDashboardPanel>
</template>
