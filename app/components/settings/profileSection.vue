<script lang="ts" setup>
import { useForm } from '@tanstack/vue-form'

const { t } = useI18n()
const toast = useToast()
const { user, updateUser, fetchSession } = useUserSession()

const updating = ref(false)
const usernameAvailable = ref(false)

const getProfileValues = () => ({
    username: user.value!.username || '',
    name: user.value!.name || '',
    bio: user.value!.bio || '',
    links: [...(user.value!.links || [])],
})

const profileFormSchema = usersUpdateSchema.pick({ username: true, name: true }).required().extend({
    bio: usersUpdateSchema.shape.bio.unwrap().unwrap(),
    links: usersUpdateSchema.shape.links.unwrap().unwrap(),
})

const saveProfile = async (data: Parameters<typeof updateUser>[0]) => {
    try {
        await updateUser(data)
        toast.add({
            id: 'profile-saved',
            icon: 'mingcute:check-line',
            title: t('settings.general.toast.profileSaved'),
            color: 'success',
        })
        await fetchSession({ force: true })
        return true
    } catch (error) {
        console.error('Failed to save profile:', error)
        toast.add({
            id: 'profile-save-failed',
            icon: 'mingcute:close-line',
            title: t('settings.general.toast.saveFailed'),
            description: t('settings.general.toast.saveFailedDescription'),
            color: 'error',
        })
        return false
    }
}

const profileForm = useForm({
    defaultValues: getProfileValues(),
    validators: [{ triggers: ['change'], run: profileFormSchema }],
    onSubmit: async ({ value, formApi }) => {
        const normalized = {
            username: value.username.trim(),
            name: value.name.trim(),
            bio: value.bio.trim(),
            links: value.links,
        }
        const current = user.value
        const changes = {
            ...(normalized.username !== current?.username ? { username: normalized.username } : {}),
            ...(normalized.name !== current?.name ? { name: normalized.name } : {}),
            ...(normalized.bio !== (current?.bio || '') ? { bio: normalized.bio } : {}),
            ...(JSON.stringify(normalized.links) !== JSON.stringify(current?.links || [])
                ? { links: normalized.links }
                : {}),
        }
        if (!Object.keys(changes).length || (await saveProfile(changes))) formApi.reset(normalized)
    },
})

const processImage = async (file: File) => {
    if (!profileForm.state.values.username) return

    updating.value = true

    try {
        const image = await uploadImage(file, 'avatar')

        await updateUser({ image: image.url })
    } catch (error) {
        console.error('Failed to upload image:', error)
    } finally {
        updating.value = false
    }
}

const { open, reset, onChange } = useFileDialog({
    accept: 'image/png, image/jpg, image/jpeg, image/webp',
    multiple: false,
    directory: false,
})

onChange(async (files) => {
    if (!files?.length || !files[0]) return
    await processImage(files[0])
    reset()
})
</script>

<template>
    <section id="profile" class="flex flex-col gap-4">
        <h3 class="text-muted text-sm leading-none font-semibold text-nowrap">
            {{ $t('settings.general.profile.title') }}
        </h3>

        <div class="flex w-full flex-col items-start gap-8 md:flex-row">
            <div
                class="flex w-full shrink-0 items-center gap-4 md:w-fit md:flex-col md:items-stretch"
            >
                <NuxtImg
                    v-if="user?.image"
                    :src="user?.image"
                    :alt="$t('settings.general.profile.avatarAlt')"
                    :width="256"
                    :height="256"
                    format="avif"
                    loading="eager"
                    fetchpriority="high"
                    class="aspect-square size-24 shrink-0 rounded-full object-cover md:size-48"
                />
                <div
                    v-else
                    class="bg-muted flex size-48 shrink-0 items-center justify-center rounded-full"
                >
                    <Icon name="mingcute:user-3-fill" size="64" class="text-muted" />
                </div>

                <UFieldGroup class="w-full">
                    <UButton
                        icon="mingcute:folder-fill"
                        :label="$t('settings.general.profile.selectImage')"
                        color="neutral"
                        variant="subtle"
                        block
                        :loading="updating"
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
                                label: $t('delete'),
                                color: 'error',
                                onSelect: () => saveProfile({ image: null }),
                            },
                        ]"
                    >
                        <UButton
                            :aria-label="$t('settings.general.profile.moreOptions')"
                            color="neutral"
                            variant="outline"
                            icon="mingcute:down-small-fill"
                            :disabled="updating"
                        />
                    </UDropdownMenu>
                </UFieldGroup>
            </div>

            <form class="flex w-full flex-col gap-4" @submit.prevent="profileForm.handleSubmit()">
                <profileForm.Field v-slot="{ field }" name="username">
                    <InputUsername
                        v-model:available="usernameAvailable"
                        :model-value="field.value"
                        :error="field.meta.isTouched ? getFormError(field.errors) : undefined"
                        :placeholder="$t('settings.general.profile.name')"
                        @update:model-value="field.handleChange"
                    />
                </profileForm.Field>

                <profileForm.Field v-slot="{ field }" name="name">
                    <UFormField
                        name="name"
                        :label="$t('settings.general.profile.name')"
                        :error="field.meta.isTouched ? getFormError(field.errors) : undefined"
                        class="w-full"
                    >
                        <UInput
                            :model-value="field.value"
                            :placeholder="$t('settings.general.profile.name')"
                            size="lg"
                            variant="subtle"
                            class="w-full"
                            @blur="field.handleBlur"
                            @update:model-value="field.handleChange"
                        />
                    </UFormField>
                </profileForm.Field>

                <profileForm.Field v-slot="{ field }" name="bio">
                    <UFormField
                        name="bio"
                        :label="$t('settings.general.profile.bio')"
                        :error="field.meta.isTouched ? getFormError(field.errors) : undefined"
                        class="w-full"
                    >
                        <UTextarea
                            :model-value="field.value"
                            :placeholder="$t('settings.general.profile.bio')"
                            autoresize
                            variant="soft"
                            class="w-full"
                            @blur="field.handleBlur"
                            @update:model-value="field.handleChange"
                        />
                    </UFormField>
                </profileForm.Field>

                <profileForm.ArrayField v-slot="{ field }" name="links">
                    <SettingsProfileLinksField
                        :model-value="field.value"
                        :error="field.meta.isTouched ? getFormError(field.errors) : undefined"
                        @update:model-value="field.handleChange"
                    />
                </profileForm.ArrayField>

                <profileForm.Subscribe
                    v-slot="formState"
                    :selector="
                        (state) => ({
                            canSubmit: state.canSubmit,
                            isDefaultValue: state.isDefaultValue,
                            isSubmitting: state.isSubmitting,
                            username: state.values.username,
                        })
                    "
                >
                    <UButton
                        type="submit"
                        :label="$t('save')"
                        color="neutral"
                        :disabled="
                            formState.isDefaultValue ||
                            !formState.canSubmit ||
                            (formState.username !== user?.username && !usernameAvailable)
                        "
                        :loading="formState.isSubmitting"
                        class="ml-auto"
                    />
                </profileForm.Subscribe>
            </form>
        </div>
    </section>
</template>
