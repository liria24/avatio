<script lang="ts" setup>
const { data, refresh } = await useFetch('/api/admin/user', {
    dedupe: 'defer',
})

const toast = useToast()

const banningUser = ref<{
    id: string
    name: string
    image?: string | null
} | null>(null)
const banReasonInput = ref('')
const banExpiresInInput = ref(0)
const modalBan = ref(false)

const banUser = async (
    userId: string | null,
    banReason: string,
    banExpiresIn?: number
) => {
    if (!userId) return

    try {
        await $fetch(`/api/admin/user/${userId}`, {
            method: 'PATCH',
            body: {
                ban: true,
                banReason,
                banExpiresIn: banExpiresIn || undefined,
            },
        })
        toast.add({
            title: 'ユーザーをBANしました',
            color: 'success',
        })
        modalBan.value = false
    } catch (error) {
        console.error('Failed to ban user:', error)
        toast.add({
            title: 'ユーザーのBANに失敗しました',
            color: 'error',
        })
    } finally {
        refresh()
        banningUser.value = null
        banReasonInput.value = ''
        banExpiresInInput.value = 0
    }
}

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
    <UModal v-model:open="modalBan" title="BAN">
        <template #body>
            <div class="flex flex-col gap-4">
                <div class="flex items-center gap-3">
                    <UAvatar :src="banningUser?.image || undefined" size="sm" />
                    <p class="leading-none text-nowrap">
                        {{ banningUser?.name || 'ユーザー' }}
                    </p>
                </div>

                <UFormField label="理由">
                    <UTextarea
                        v-model="banReasonInput"
                        placeholder="理由を入力してください"
                        autoresize
                        class="w-full"
                    />
                </UFormField>
                <UFormField label="BAN 期間 (秒)">
                    <UInputNumber
                        v-model="banExpiresInInput"
                        placeholder="0 で無期限"
                        class="w-full"
                    />
                </UFormField>
            </div>
        </template>
        <template #footer>
            <div class="flex w-full items-center justify-end gap-2">
                <UButton
                    label="キャンセル"
                    variant="ghost"
                    @click="modalBan = false"
                />
                <UButton
                    v-if="banningUser"
                    label="BAN"
                    color="neutral"
                    @click="
                        banUser(
                            banningUser.id,
                            banReasonInput,
                            banExpiresInInput
                        )
                    "
                />
            </div>
        </template>
    </UModal>

    <UCard>
        <template #header>
            <h2 class="text-xl font-semibold text-nowrap">ユーザー</h2>
        </template>

        <div class="flex max-h-96 flex-col gap-2 overflow-y-auto p-1">
            <div
                v-for="user in data?.users"
                :key="user.id"
                class="ring-accented flex items-center gap-3 rounded-lg p-2 ring-1"
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
                                    else {
                                        banningUser = {
                                            id: user.id,
                                            name: user.name,
                                            image: user.image,
                                        }
                                        modalBan = true
                                    }
                                },
                            },
                        ],
                    ]"
                >
                    <UButton icon="lucide:menu" variant="soft" size="sm" />
                </UDropdownMenu>
            </div>
        </div>
    </UCard>
</template>
