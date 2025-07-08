<script lang="ts" setup>
import { z } from 'zod/v4'
import { VueDraggable } from 'vue-draggable-plus'

interface Props {
    changeUserId?: boolean
}
const props = defineProps<Props>()

const session = await useGetSession()
const toast = useToast()

if (!session.value) navigateTo('/login')

const { data } = await useUser(session.value!.user.id, {
    getCachedData: undefined,
})

// リアクティブな状態を統合
const ui = reactive({
    newId: data.value?.id || '',
    newLink: '',
    croppingImage: null as Blob | null,
    imageUploading: false,
    profileUpdating: false,
    idUpdating: false,
    modalChangeUserId: props.changeUserId || false,
    modalCropImage: false,
    newIdCheckState: 'idle' as
        | 'idle'
        | 'checking'
        | 'available'
        | 'unavailable'
        | 'error',
})

const _schema = userUpdateSchema
    .required({
        id: true,
        name: true,
        image: true,
        bio: true,
    })
    .extend({
        links: z.string().array(),
    })
type profileSchema = z.infer<typeof _schema>
const state = reactive<profileSchema>({
    id: data.value?.id || '',
    name: data.value?.name || '',
    image: data.value?.image || '',
    bio: data.value?.bio || '',
    links: data.value?.links || [],
})

const newIdCheckStatusMessages = {
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
} as const

const checkNewIdAvailability = useDebounceFn(async (id: string) => {
    if (!id?.length || id === session.value!.user.id) {
        ui.newIdCheckState = 'idle'
        return
    }

    const validateResult = userUpdateSchema.shape.id.safeParse(id)
    if (!validateResult.success) {
        ui.newIdCheckState = 'idle'
        return
    }

    ui.newIdCheckState = 'checking'

    try {
        console.log('Checking profile ID availability:', id)
        const response = await $fetch('/api/users/id-availability', {
            query: { id },
        })
        ui.newIdCheckState = response.available ? 'available' : 'unavailable'
    } catch (error) {
        console.error('Error checking profile ID availability:', error)
        ui.newIdCheckState = 'error'
    }
}, 500)

watch(
    () => ui.newId,
    (id) => {
        if (id && id.length > 2) {
            checkNewIdAvailability(id)
        } else {
            ui.newIdCheckState = 'idle'
        }
    }
)

const addLink = () => {
    const trimmedLink = ui.newLink.trim()
    if (!trimmedLink) return

    try {
        new URL(trimmedLink)
    } catch {
        toast.add({
            title: '無効なリンク',
            description: '正しいURLを入力してください。',
            color: 'error',
        })
        return
    }

    if (state.links.includes(trimmedLink)) {
        toast.add({
            title: 'リンクがすでに存在します',
            description: '同じリンクは追加できません。',
            color: 'warning',
        })
        return
    }

    state.links.push(trimmedLink)
    ui.newLink = ''
}

const removeLink = (index: number) => {
    if (index < 0 || index >= state.links.length) return
    state.links.splice(index, 1)
}

// API呼び出しを共通化
const updateUserData = async (updateData: Partial<profileSchema>) => {
    await $fetch(session.value!.user.id, {
        baseURL: '/api/users/',
        method: 'PUT',
        body: updateData,
    })
}

const onSubmit = async () => {
    ui.profileUpdating = true

    try {
        await updateUserData(state)
        toast.add({
            title: 'プロフィールが保存されました',
            color: 'success',
        })
    } catch (error) {
        console.error('Error saving profile:', error)
        toast.add({
            title: '保存に失敗しました',
            description: 'プロフィールの保存中にエラーが発生しました。',
            color: 'error',
        })
    } finally {
        ui.profileUpdating = false
    }
}

const removeUserImage = async () => {
    try {
        await updateUserData({ image: null })
        state.image = null
        toast.add({
            title: 'プロフィール画像が削除されました',
            color: 'success',
        })
    } catch (error) {
        console.error('Error removing user image:', error)
        toast.add({
            title: '画像の削除に失敗しました',
            description: 'プロフィール画像の削除中にエラーが発生しました。',
            color: 'error',
        })
    }
}

const updateId = async (newId: string) => {
    ui.idUpdating = true

    try {
        await updateUserData({ id: newId })
        toast.add({
            title: 'ユーザーIDが変更されました',
            description: 'ページを更新しています...',
            color: 'success',
        })
        await navigateTo('/settings', { external: true })
    } catch (error) {
        console.error('Error updating user ID:', error)
        toast.add({
            title: 'ユーザーIDの変更に失敗しました',
            description: 'ユーザーIDの変更中にエラーが発生しました。',
            color: 'error',
        })
    } finally {
        ui.idUpdating = false
    }
}

const { open, reset, onChange } = useFileDialog({
    accept: 'image/png, image/jpg, image/jpeg, image/webp, image/tiff',
    multiple: false,
    directory: false,
})

onChange(async (files) => {
    if (!files?.length || !files[0]) return

    ui.croppingImage = new Blob([files[0]])
    ui.modalCropImage = true
    reset()
})

const updateImage = async () => {
    if (!ui.croppingImage) {
        toast.add({
            title: '画像の取得に失敗しました',
            color: 'error',
        })
        return
    }

    ui.imageUploading = true

    try {
        const formData = new FormData()
        formData.append('blob', ui.croppingImage)
        formData.append('path', 'avatar')

        const response = await $fetch('/api/images', {
            method: 'POST',
            body: formData,
        })

        await updateUserData({ image: response.url })
        state.image = response.url

        toast.add({
            title: 'プロフィール画像が更新されました。',
            color: 'success',
        })

        ui.modalCropImage = false
    } catch (error) {
        console.error('Failed to upload image:', error)
        toast.add({
            title: '画像のアップロードに失敗しました',
            color: 'error',
        })
    } finally {
        ui.imageUploading = false
    }
}

const cancelCropImage = () => {
    ui.modalCropImage = false
    ui.croppingImage = null
}
</script>

<template>
    <UModal v-model:open="ui.modalCropImage" title="画像のトリミング">
        <template #body>
            <ImageCropper v-model="ui.croppingImage" />
        </template>

        <template #footer>
            <UButton
                label="キャンセル"
                variant="ghost"
                @click="cancelCropImage"
            />
            <UButton
                label="保存"
                color="neutral"
                :loading="ui.imageUploading"
                @click="updateImage"
            />
        </template>
    </UModal>

    <UForm :state :schema="userUpdateSchema" @submit="onSubmit">
        <UCard>
            <template #header>
                <h2 class="text-lg leading-none font-semibold text-nowrap">
                    プロフィール
                </h2>
            </template>

            <div class="flex w-full items-start gap-8">
                <div class="flex shrink-0 flex-col gap-4">
                    <NuxtImg
                        v-if="state.image"
                        v-slot="{ isLoaded, src, imgAttrs }"
                        :src="state.image"
                        :alt="state.name"
                        :width="192"
                        :height="192"
                        format="webp"
                        custom
                    >
                        <img
                            v-if="isLoaded"
                            v-bind="imgAttrs"
                            :src="src"
                            class="aspect-square size-48 shrink-0 rounded-full object-cover"
                        />
                        <USkeleton
                            v-else
                            class="aspect-square size-48 shrink-0 rounded-full"
                        />
                    </NuxtImg>
                    <div
                        v-else
                        class="bg-muted flex size-48 shrink-0 items-center justify-center rounded-full"
                    >
                        <Icon
                            name="lucide:user-round"
                            size="64"
                            class="text-muted"
                        />
                    </div>

                    <UButtonGroup class="w-full">
                        <UButton
                            icon="lucide:folder"
                            label="画像を選択"
                            color="neutral"
                            variant="subtle"
                            block
                            :loading="ui.imageUploading"
                            @click="open()"
                        />

                        <UDropdownMenu
                            :content="{
                                side: 'bottom',
                                align: 'end',
                            }"
                            :items="[
                                {
                                    icon: 'lucide:trash',
                                    label: 'アイコンを削除',
                                    color: 'error',
                                    onSelect: removeUserImage,
                                },
                            ]"
                        >
                            <UButton
                                color="neutral"
                                variant="outline"
                                icon="lucide:chevron-down"
                                :disabled="ui.imageUploading"
                            />
                        </UDropdownMenu>
                    </UButtonGroup>
                </div>

                <div class="flex flex-col gap-4">
                    <UFormField label="ID" class="w-full">
                        <div class="flex items-center gap-1.5">
                            <span
                                class="text-muted leading-none font-semibold text-nowrap"
                            >
                                {{ state.id }}
                            </span>
                            <UModal
                                v-model:open="ui.modalChangeUserId"
                                title="ID の変更"
                            >
                                <UButton
                                    icon="lucide:pen-line"
                                    label="変更"
                                    variant="ghost"
                                    size="sm"
                                />

                                <template #body>
                                    <div class="flex flex-col gap-4">
                                        <UAlert
                                            icon="lucide:alert-triangle"
                                            title="注意"
                                            description="ユーザーページの URL が変更され、変更前の URL からはアクセスできなくなります。"
                                            color="neutral"
                                            variant="subtle"
                                        />
                                        <UFormField label="新しいユーザーID">
                                            <UInput
                                                v-model="ui.newId"
                                                placeholder="新しいユーザーIDを入力"
                                                class="w-full"
                                            />
                                            <template #hint>
                                                <div
                                                    v-if="
                                                        ui.newIdCheckState !==
                                                        'idle'
                                                    "
                                                    class="flex items-center gap-1"
                                                >
                                                    <Icon
                                                        :name="
                                                            newIdCheckStatusMessages[
                                                                ui
                                                                    .newIdCheckState
                                                            ].icon
                                                        "
                                                        size="16"
                                                        class="text-toned"
                                                    />
                                                    <span
                                                        class="text-toned text-xs"
                                                    >
                                                        {{
                                                            newIdCheckStatusMessages[
                                                                ui
                                                                    .newIdCheckState
                                                            ].message
                                                        }}
                                                    </span>
                                                </div>
                                            </template>
                                        </UFormField>
                                    </div>
                                </template>

                                <template #footer>
                                    <div
                                        class="flex w-full items-center justify-end gap-2"
                                    >
                                        <UButton
                                            :disabled="ui.idUpdating"
                                            label="キャンセル"
                                            variant="ghost"
                                            @click="
                                                ui.modalChangeUserId = false
                                            "
                                        />
                                        <UButton
                                            :loading="ui.idUpdating"
                                            label="変更を保存"
                                            color="neutral"
                                            variant="solid"
                                            :disabled="
                                                ui.newIdCheckState !==
                                                'available'
                                            "
                                            @click="updateId(ui.newId)"
                                        />
                                    </div>
                                </template>
                            </UModal>
                        </div>
                    </UFormField>

                    <UFormField name="name" label="ユーザー名" class="w-full">
                        <UInput
                            v-model="state.name"
                            placeholder="ユーザー名を入力"
                            size="lg"
                            variant="subtle"
                            class="w-full"
                        />
                    </UFormField>

                    <UFormField name="bio" label="bio" class="w-full">
                        <UTextarea
                            v-model="state.bio"
                            placeholder="自己紹介を入力"
                            autoresize
                            variant="soft"
                            class="w-full"
                        />
                    </UFormField>

                    <UFormField name="links" label="リンク" class="w-full">
                        <div class="flex w-full flex-wrap items-center gap-2">
                            <VueDraggable
                                v-model="state.links as string[]"
                                :animation="150"
                                handle=".draggable"
                                class="contents"
                            >
                                <div
                                    v-for="(link, index) in state.links"
                                    :key="`link-${index}`"
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
                                    <UTooltip :text="link" :delay-duration="50">
                                        <Icon
                                            :name="linkAttributes(link).icon"
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
                            </VueDraggable>

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
                                            v-model="ui.newLink"
                                            placeholder="リンクを追加"
                                            class="w-full"
                                            @keyup.enter="addLink"
                                        />
                                        <UButton
                                            label="追加"
                                            variant="soft"
                                            :disabled="!ui.newLink.trim()"
                                            @click="addLink"
                                        />
                                    </div>
                                </template>
                            </UPopover>
                        </div>
                    </UFormField>
                </div>
            </div>

            <template #footer>
                <div class="flex w-full justify-end">
                    <UButton
                        :disabled="
                            !['available', 'idle'].includes(ui.newIdCheckState)
                        "
                        :loading="ui.profileUpdating"
                        type="submit"
                        label="保存"
                        color="neutral"
                        block
                        class="w-full max-w-32"
                    />
                </div>
            </template>
        </UCard>
    </UForm>
</template>
