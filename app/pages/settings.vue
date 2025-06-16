<script lang="ts" setup>
import { z } from 'zod/v4'

const user = useSupabaseUser()
const toast = useToast()

if (!user.value) showError('ログインしてください')

const userSettingsSchema = z.object({
    name: z
        .string()
        .min(1, 'ユーザー名を入力してください')
        .max(124, 'ユーザー名は124文字以内で入力してください')
        .refine(
            (name) => !/^\s+$/.test(name),
            '空白のみのユーザー名は使用できません'
        ),
    bio: z.string().max(140, 'bioは140文字以内で入力してください'),
    links: z
        .array(z.url('有効なURLを入力してください'))
        .max(8, 'リンクは8個まで追加できます'),
})

const currentUserData = ref<User | null>(null)
const name = ref<string>('')
const avatar = ref<Blob | null>(null)
const currentAvatar = ref<string | null>(null)
const bio = ref<string>('')
const links = ref<string[]>([])
const saving = ref(false)

// ユーザーデータの取得
const fetchUserData = async () => {
    try {
        currentUserData.value = await $fetch(`/api/user/${user.value?.id}`)
        name.value = currentUserData.value?.name ?? ''
        currentAvatar.value = currentUserData.value?.avatar ?? null
        bio.value = currentUserData.value?.bio ?? ''
        links.value = currentUserData.value?.links ?? []
    } catch (error) {
        console.error('Error fetching user data:', error)
    }
}

// ユーザーデータ更新の共通処理
const updateUserData = async (deleteAvatarFlag = false) => {
    saving.value = true

    try {
        const response = await $fetch('/api/user', {
            method: 'PATCH',
            body: {
                deleteAvatar: deleteAvatarFlag,
                name: name.value,
                bio: bio.value,
                links: links.value,
                newAvatar:
                    avatar.value && !deleteAvatarFlag
                        ? await blobToBase64(avatar.value)
                        : null,
            },
        })

        userProfile.value.name = response.name
        userProfile.value.avatar = response.avatar
        currentAvatar.value = response.avatar

        return response
    } catch (error) {
        console.error('Error updating user data:', error)
        throw error
    } finally {
        saving.value = false
    }
}

const save = async () => {
    const validationResult = userSettingsSchema.safeParse({
        name: name.value,
        bio: bio.value,
        links: links.value,
    })

    if (!validationResult.success) {
        const formattedErrors = validationResult.error.format()
        const firstError =
            formattedErrors.name?._errors[0] ||
            formattedErrors.bio?._errors[0] ||
            formattedErrors.links?._errors[0]

        if (firstError) {
            toast.add({ title: firstError, color: 'error' })
            return
        }
    }

    try {
        await updateUserData(false)
        avatar.value = null
        toast.add({ title: 'ユーザー情報を保存しました' })
    } catch {
        toast.add({ title: 'ユーザー情報の保存に失敗しました', color: 'error' })
    }
}

const deleteAvatar = async () => {
    if (!currentAvatar.value) return

    try {
        await updateUserData(true)
        toast.add({ title: 'アバターを削除しました' })
    } catch {
        toast.add({ title: 'ユーザー情報の保存に失敗しました', color: 'error' })
    }
}

await fetchUserData()

defineSeo({ title: 'ユーザー設定' })
</script>

<template>
    <div v-if="!currentUserData" class="flex w-full flex-col items-center">
        <p class="mt-5 text-zinc-400">ユーザーデータの取得に失敗しました</p>
    </div>

    <div v-else class="flex w-full flex-col gap-4 px-2">
        <div class="flex items-center justify-between">
            <UiTitle
                label="プロフィール"
                icon="lucide:user-round"
                size="lg"
                is="h1"
            />
        </div>

        <div
            class="flex w-full flex-col gap-6 rounded-xl p-5 ring-1 ring-zinc-300 dark:ring-zinc-600"
        >
            <div class="flex grow items-center gap-8">
                <UserSettingAvatar
                    v-model:avatar="avatar"
                    v-model:current-avatar="currentAvatar"
                    @delete-avatar="deleteAvatar"
                />

                <div class="flex grow flex-col gap-2">
                    <div class="flex grow items-center justify-between">
                        <UiTitle
                            label="ユーザー名"
                            icon="lucide:pencil"
                            is="h2"
                        />
                        <p
                            v-if="name?.length > 124"
                            class="text-sm font-medium whitespace-nowrap text-red-400 dark:text-red-400"
                        >
                            {{ name?.length || 0 }} / 124
                        </p>
                    </div>

                    <UserSettingName v-model="name" class="w-full" />
                </div>
            </div>

            <div class="flex grow flex-col gap-2">
                <div class="flex grow items-center justify-between">
                    <UiTitle label="bio" icon="lucide:text" is="h2" />
                    <p
                        :data-exceeded="bio?.length > 140"
                        class="text-sm font-medium whitespace-nowrap text-zinc-700 data-[exceeded=true]:text-red-400 dark:text-zinc-400 dark:data-[exceeded=true]:text-red-400"
                    >
                        {{ bio?.length || 0 }} / 140
                    </p>
                </div>

                <UserSettingBio v-model="bio" />
            </div>

            <div class="flex grow flex-col gap-2">
                <div class="flex grow items-center justify-between">
                    <UiTitle label="リンク" icon="lucide:link" is="h2" />
                    <p
                        :data-exceeded="links?.length > 8"
                        class="text-sm font-medium whitespace-nowrap text-zinc-700 data-[exceeded=true]:text-red-400 dark:text-zinc-400 dark:data-[exceeded=true]:text-red-400"
                    >
                        {{ links?.length || 0 }} / 8
                    </p>
                </div>

                <UserSettingLinks v-model="links" />
            </div>

            <USeparator />

            <Button :disabled="saving" @click="save">
                <Icon
                    :name="saving ? 'svg-spinners:ring-resize' : 'lucide:save'"
                    size="18"
                    class="text-zinc-600 dark:text-zinc-300"
                />
                <span class="hidden md:inline">
                    {{ saving ? '保存中' : '保存' }}
                </span>
            </Button>
        </div>

        <UiTitle
            label="ショップ"
            icon="lucide:store"
            size="lg"
            is="h1"
            class="mt-5"
        />
        <UserSettingShopVerify />

        <UiTitle
            label="アカウント"
            icon="lucide:bolt"
            size="lg"
            is="h1"
            class="mt-5"
        />
        <UserSettingAccount />
    </div>
</template>
