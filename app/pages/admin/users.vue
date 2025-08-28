<script lang="ts" setup>
import { LazyModalAdminBanUser } from '#components'

definePageMeta({
    middleware: 'admin',
    layout: 'dashboard',
})

const toast = useToast()
const overlay = useOverlay()
const nuxtApp = useNuxtApp()

const modalBan = overlay.create(LazyModalAdminBanUser)

const { data, refresh } = await useFetch('/api/admin/user', {
    dedupe: 'defer',
    headers:
        import.meta.server && nuxtApp.ssrContext?.event.headers
            ? nuxtApp.ssrContext.event.headers
            : undefined,
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
            <UDashboardNavbar title="Users" />
        </template>

        <template #body>
            <UPageList divide>
                <div
                    v-for="user in data?.users"
                    :key="user.id"
                    class="flex items-center gap-3 p-2"
                >
                    <UAvatar :src="user.image || undefined" size="xs" />

                    <div class="flex grow items-center gap-2">
                        <p
                            class="text-muted line-clamp-1 text-sm leading-none break-all"
                        >
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
                                    icon: 'lucide:user-round',
                                    onSelect: () => navigateTo(`/@${user.id}`),
                                },
                            ],
                            [
                                {
                                    label: 'ロール',
                                    icon: 'lucide:shield',
                                    children: [
                                        {
                                            label: 'ユーザー',
                                            icon: 'lucide:user-round',
                                        },
                                        {
                                            label: '管理者',
                                            icon: 'lucide:shield-check',
                                        },
                                    ],
                                },
                                {
                                    label: user.banned ? 'BAN 解除' : 'BAN',
                                    icon: user.banned
                                        ? 'lucide:undo-2'
                                        : 'lucide:ban',
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
                        <UButton icon="lucide:menu" variant="soft" size="sm" />
                    </UDropdownMenu>
                </div>
            </UPageList>
        </template>
    </UDashboardPanel>
</template>
