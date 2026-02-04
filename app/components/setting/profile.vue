<script lang="ts" setup>
const { getSession } = useAuth()
const session = await getSession()
const {
    profileState: state,
    profileUI: ui,
    initializeProfile,
    addLink,
    removeLink,
    submitProfile,
    removeUserImage: removeUserImageAction,
    processProfileImage,
} = useUserSettings()

// Initialize profile data
await initializeProfile(session.value!.user.username!)

const onSubmit = async () => {
    await submitProfile(session.value!.user.username!)
}

const removeUserImage = async () => {
    await removeUserImageAction(session.value!.user.username!)
}

const { open, reset, onChange } = useFileDialog({
    accept: 'image/png, image/jpg, image/jpeg, image/webp, image/tiff',
    multiple: false,
    directory: false,
})

onChange(async (files) => {
    if (!files?.length || !files[0]) return

    await processProfileImage(files[0], session.value!.user.username!)
    reset()
})
</script>

<template>
    <UForm :state :schema="userUpdateSchema" @submit="onSubmit">
        <UCard>
            <template #header>
                <h2 class="text-lg leading-none font-semibold text-nowrap">プロフィール</h2>
            </template>

            <div class="flex w-full flex-col items-start gap-8 md:flex-row">
                <div
                    class="flex w-full shrink-0 items-center gap-4 md:w-fit md:flex-col md:items-stretch"
                >
                    <NuxtImg
                        v-if="state.image"
                        v-slot="{ isLoaded, src, imgAttrs }"
                        :src="state.image"
                        :width="256"
                        :height="256"
                        format="avif"
                        custom
                    >
                        <img
                            v-if="isLoaded"
                            v-bind="imgAttrs"
                            :src
                            :alt="state.name"
                            loading="eager"
                            fetchpriority="high"
                            class="aspect-square size-24 shrink-0 rounded-full object-cover md:size-48"
                        />
                        <USkeleton
                            v-else
                            class="aspect-square size-24 shrink-0 rounded-full md:size-48"
                        />
                    </NuxtImg>
                    <div
                        v-else
                        class="bg-muted flex size-48 shrink-0 items-center justify-center rounded-full"
                    >
                        <Icon name="mingcute:user-3-fill" size="64" class="text-muted" />
                    </div>

                    <UFieldGroup class="w-full">
                        <UButton
                            icon="mingcute:folder-fill"
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
                                    icon: 'mingcute:delete-2-fill',
                                    label: 'アイコンを削除',
                                    color: 'error',
                                    onSelect: removeUserImage,
                                },
                            ]"
                        >
                            <UButton
                                aria-label="その他のオプション"
                                color="neutral"
                                variant="outline"
                                icon="mingcute:down-small-fill"
                                :disabled="ui.imageUploading"
                            />
                        </UDropdownMenu>
                    </UFieldGroup>
                </div>

                <div class="flex w-full flex-col gap-4">
                    <InputUsername v-model="state.username" placeholder="新しいユーザーIDを入力" />

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
                        <ReorderGroup
                            v-model:values="state.links"
                            as="div"
                            axis="y"
                            class="flex flex-col"
                        >
                            <ReorderItem
                                v-for="(link, index) in state.links"
                                :key="link"
                                :value="link"
                                as="div"
                                class="hover:bg-elevated flex cursor-move items-center gap-2 rounded-md p-3 transition-colors"
                            >
                                <Icon
                                    name="mingcute:dots-fill"
                                    size="18"
                                    class="text-muted shrink-0"
                                />

                                <UTooltip :text="link" :delay-duration="50">
                                    <Icon
                                        :name="linkAttributes(link).icon"
                                        size="18"
                                        class="text-toned shrink-0"
                                    />
                                </UTooltip>

                                <p class="line-clamp-1 text-sm leading-none break-all">
                                    {{ link }}
                                </p>

                                <UButton
                                    aria-label="リンクを削除"
                                    icon="mingcute:close-line"
                                    variant="ghost"
                                    size="sm"
                                    @click="removeLink(index)"
                                />
                            </ReorderItem>
                        </ReorderGroup>
                        <UPopover
                            :content="{
                                side: 'bottom',
                            }"
                        >
                            <UButton
                                v-if="state.links.length < 8"
                                icon="mingcute:add-line"
                                label="リンクを追加"
                                variant="ghost"
                                block
                                class="p-2"
                            />

                            <template #content>
                                <div class="flex max-w-96 items-center gap-2 p-2">
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
                    </UFormField>
                </div>
            </div>

            <template #footer>
                <div class="flex w-full justify-end">
                    <UButton
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
