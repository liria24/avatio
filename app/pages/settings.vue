<script lang="ts" setup>
import type { z } from 'zod/v4'
import { VueDraggable } from 'vue-draggable-plus'

const session = await useGetSession()
const toast = useToast()

if (!session.value) navigateTo('/login')

const { data } = await useUser(session.value!.user.id, {
    getCachedData: undefined,
})
const newLink = ref('')
const profileUpdating = ref(false)
const modalDeleteUser = ref(false)
const modalChangeUserIdWarning = ref(false)

type profileSchema = z.infer<typeof userUpdateSchema>
const profileState = reactive<profileSchema>({
    id: data.value?.id || '',
    name: data.value?.name || '',
    image: data.value?.image || '',
    bio: data.value?.bio || '',
    links: data.value?.links || [],
})

type profileIdCheckStatus =
    | 'idle'
    | 'checking'
    | 'available'
    | 'unavailable'
    | 'error'

const profileIdCheckStatusMessages: Record<
    profileIdCheckStatus,
    { icon: string; message: string }
> = {
    idle: { icon: '', message: '' },
    checking: { icon: 'svg-spinners:ring-resize', message: '確認中...' },
    available: { icon: 'lucide:check', message: '使用可能' },
    unavailable: {
        icon: 'lucide:x',
        message: 'このユーザーIDはすでに使用されています。',
    },
    error: {
        icon: 'lucide:alert-triangle',
        message: 'ユーザーIDの確認中にエラーが発生しました。',
    },
}

const profileIdCheckState = ref<profileIdCheckStatus>('idle')

const checkProfileIdAvailability = useDebounceFn(async (id: string) => {
    if (!id?.length || id === session.value?.user.id)
        return (profileIdCheckState.value = 'idle')

    const validateResult = userUpdateSchema.shape.id.safeParse(id)
    if (!validateResult.success) return (profileIdCheckState.value = 'idle')

    profileIdCheckState.value = 'checking'

    try {
        console.log('Checking profile ID availability:', id)
        const response = await $fetch('/api/user/id-availability', {
            query: { id },
        })

        profileIdCheckState.value = response.available
            ? 'available'
            : 'unavailable'
    } catch (error) {
        console.error('Error checking profile ID availability:', error)
        profileIdCheckState.value = 'error'
    }
}, 500)

watch(
    () => profileState.id,
    (newId) => {
        if (newId && newId.length > 2) checkProfileIdAvailability(newId)
        else profileIdCheckState.value = 'idle'
    }
)

const addLink = () => {
    if (!newLink.value.trim() || !profileState.links) return
    try {
        new URL(newLink.value.trim())
    } catch {
        toast.add({
            title: '無効なリンク',
            description: '正しいURLを入力してください。',
            color: 'error',
        })
        return
    }
    if (profileState.links.includes(newLink.value.trim())) {
        toast.add({
            title: 'リンクがすでに存在します',
            description: '同じリンクは追加できません。',
            color: 'warning',
        })
        return
    }
    profileState.links.push(newLink.value.trim())
    newLink.value = ''
}

const removeLink = (index: number) => {
    if (!profileState.links || index < 0 || index >= profileState.links.length)
        return
    profileState.links.splice(index, 1)
}

const profileOnSubmit = async () => {
    profileUpdating.value = true

    try {
        await $fetch(session.value!.user.id, {
            baseURL: '/api/user/',
            method: 'PUT',
            body: profileState,
        })
        toast.add({
            title: 'プロフィールが保存されました',
            color: 'success',
        })
        navigateTo('/settings', { external: true })
    } catch (error) {
        console.error('Error saving profile:', error)
        toast.add({
            title: '保存に失敗しました',
            description: 'プロフィールの保存中にエラーが発生しました。',
            color: 'error',
        })
    } finally {
        profileUpdating.value = false
    }
}

const deleteUser = async () => {
    await authClient.deleteUser({ callbackURL: '/' })
}
</script>

<template>
    <div class="flex flex-col gap-6">
        <h1 class="text-lg font-medium text-nowrap">ユーザー設定</h1>

        <UForm
            :state="profileState"
            :schema="userUpdateSchema"
            @submit="profileOnSubmit"
        >
            <UCard>
                <template #header>
                    <h2 class="text-lg leading-none font-semibold text-nowrap">
                        プロフィール
                    </h2>
                </template>

                <div class="flex flex-col gap-4">
                    <UFormField name="id" label="ユーザーID" class="w-full">
                        <UInput
                            v-model="profileState.id"
                            placeholder="ユーザーIDを入力"
                            class="w-full"
                        />

                        <template #hint>
                            <div
                                v-if="profileIdCheckState !== 'idle'"
                                class="flex items-center gap-1"
                            >
                                <Icon
                                    :name="
                                        profileIdCheckStatusMessages[
                                            profileIdCheckState
                                        ].icon
                                    "
                                    size="16"
                                    class="text-toned"
                                />
                                <span class="text-toned text-xs">
                                    {{
                                        profileIdCheckStatusMessages[
                                            profileIdCheckState
                                        ].message
                                    }}
                                </span>
                            </div>
                        </template>
                    </UFormField>

                    <UFormField name="name" label="ユーザー名" class="w-full">
                        <UInput
                            v-model="profileState.name"
                            placeholder="ユーザー名を入力"
                            class="w-full"
                        />
                    </UFormField>

                    <UFormField name="bio" label="bio" class="w-full">
                        <UTextarea
                            v-model="profileState.bio"
                            placeholder="自己紹介を入力"
                            autoresize
                            class="w-full"
                        />
                    </UFormField>

                    <UFormField name="links" label="リンク" class="w-full">
                        <VueDraggable
                            v-model="profileState.links as string[]"
                            :animation="150"
                            handle=".draggable"
                            class="flex w-full flex-wrap items-center gap-2"
                        >
                            <div
                                v-for="(i, index) in profileState.links"
                                :key="'link-' + index"
                                class="ring-accented flex items-center gap-2 rounded-md p-1 ring-1"
                            >
                                <div
                                    class="draggable hover:bg-elevated grid cursor-move rounded-md px-1 py-2 transition-colors"
                                >
                                    <Icon
                                        name="lucide:grip-vertical"
                                        size="18"
                                        class="text-muted shrink-0"
                                    />
                                </div>
                                <UTooltip :text="i" :delay-duration="50">
                                    <Icon
                                        :name="linkAttributes(i).icon"
                                        size="18"
                                        class="text-toned shrink-0"
                                    />
                                </UTooltip>
                                <UButton
                                    icon="lucide:x"
                                    variant="ghost"
                                    size="sm"
                                    @click="removeLink(index)"
                                />
                            </div>

                            <UPopover
                                :content="{
                                    side: 'right',
                                }"
                            >
                                <UButton
                                    icon="lucide:plus"
                                    variant="ghost"
                                    class="p-3"
                                />

                                <template #content>
                                    <div
                                        class="flex max-w-96 items-center gap-2 p-2"
                                    >
                                        <UInput
                                            v-model="newLink"
                                            placeholder="リンクを追加"
                                            class="w-full"
                                            @keyup.enter="addLink"
                                        />
                                        <UButton
                                            label="追加"
                                            variant="soft"
                                            :disabled="!newLink.trim()"
                                            @click="addLink"
                                        />
                                    </div>
                                </template>
                            </UPopover>
                        </VueDraggable>
                    </UFormField>
                </div>

                <template #footer>
                    <div class="flex w-full justify-end">
                        <UButton
                            v-if="profileState.id === session?.user.id"
                            :disabled="
                                !['available', 'idle'].includes(
                                    profileIdCheckState
                                )
                            "
                            :loading="profileUpdating"
                            type="submit"
                            label="保存"
                            color="neutral"
                        />
                        <UModal
                            v-else
                            v-model:open="modalChangeUserIdWarning"
                            title="ユーザーIDの変更"
                        >
                            <UButton
                                :disabled="
                                    !['available', 'idle'].includes(
                                        profileIdCheckState
                                    )
                                "
                                :loading="profileUpdating"
                                label="保存"
                                color="neutral"
                            />

                            <template #body>
                                <UAlert
                                    icon="lucide:alert-triangle"
                                    title="ユーザーIDを変更しますか？"
                                    description="ユーザーページの URL が変更され、変更前の URL からはアクセスできなくなります。"
                                    color="neutral"
                                    variant="subtle"
                                />
                            </template>

                            <template #footer>
                                <div
                                    class="flex w-full items-center justify-end gap-2"
                                >
                                    <UButton
                                        :disabled="profileUpdating"
                                        label="キャンセル"
                                        variant="ghost"
                                        @click="
                                            modalChangeUserIdWarning = false
                                        "
                                    />
                                    <UButton
                                        :loading="profileUpdating"
                                        label="プロフィールを保存"
                                        color="neutral"
                                        variant="solid"
                                        @click="profileOnSubmit"
                                    />
                                </div>
                            </template>
                        </UModal>
                    </div>
                </template>
            </UCard>
        </UForm>

        <UCard variant="soft">
            <template #header>
                <h2 class="text-lg leading-none font-semibold text-nowrap">
                    DANGER ZONE
                </h2>
            </template>

            <div class="flex w-full items-center justify-between gap-2">
                <div class="flex flex-col gap-1">
                    <h3 class="text-sm font-semibold">アカウント削除</h3>
                    <p class="text-muted text-xs">
                        アカウントおよびアカウントに紐づくデータをすべて削除します。<br />
                        削除したアカウントは復元できません。
                    </p>
                </div>
                <UModal v-model:open="modalDeleteUser" title="アカウント削除">
                    <UButton
                        label="アカウント削除"
                        color="error"
                        variant="subtle"
                    />

                    <template #body>
                        <UAlert
                            icon="lucide:trash"
                            title="本当にアカウントを削除しますか？"
                            description="削除したアカウントは復元できません。"
                            color="error"
                            variant="subtle"
                        />
                    </template>

                    <template #footer>
                        <div class="flex w-full items-center justify-end gap-2">
                            <UButton
                                label="キャンセル"
                                variant="ghost"
                                @click="modalDeleteUser = false"
                            />
                            <UButton
                                label="削除"
                                color="error"
                                variant="solid"
                                @click="deleteUser"
                            />
                        </div>
                    </template>
                </UModal>
            </div>
        </UCard>
    </div>
</template>
