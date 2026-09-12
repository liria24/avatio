<script lang="ts" setup>
import { en, ja } from '@nuxt/ui/locale'
import { useForm } from '@tanstack/vue-form'

definePageMeta({
    auth: 'user',
})

const { app } = useAppConfig()
const { t, locale, localeProperties, setLocale } = useI18n()
const toast = useToast()
const { user, updateUser, fetchSession } = useUserSession()
const { data: userSettings } = await useUserSettings()
const { update: updateUserSettings } = useUserSettingsUpdate()

const updating = ref(false)
const usernameAvailable = ref(false)
const newLink = ref('')
const editingLink = ref('')

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

const validateLink = (value: string, currentIndex = -1) => {
    const trimmedLink = value.trim()
    if (!trimmedLink) return

    try {
        new URL(trimmedLink)
    } catch {
        toast.add({
            id: 'link-invalid',
            icon: 'mingcute:close-line',
            title: t('settings.general.toast.invalidLink'),
            description: t('settings.general.toast.invalidLinkDescription'),
            color: 'error',
        })
        return
    }

    if (
        profileForm.state.values.links.some(
            (link, index) => link === trimmedLink && index !== currentIndex,
        )
    ) {
        toast.add({
            id: 'link-duplicate',
            icon: 'mingcute:warning-line',
            title: t('settings.general.toast.linkExists'),
            description: t('settings.general.toast.linkExistsDescription'),
            color: 'warning',
        })
        return
    }

    return trimmedLink
}

const addLink = () => {
    const link = validateLink(newLink.value)
    if (!link) return false

    profileForm.pushFieldValue('links', link)
    newLink.value = ''
    return true
}

const editLink = (index: number, close: () => void) => {
    if (index < 0 || index >= profileForm.state.values.links.length) return
    const link = validateLink(editingLink.value, index)
    if (!link) return
    profileForm.setFieldValue('links', (links) =>
        links.map((current, candidate) => (candidate === index ? link : current)),
    )
    close()
}

const removeLink = (index: number) => {
    if (index < 0 || index >= profileForm.state.values.links.length) return
    profileForm.removeFieldValue('links', index)
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

useSeo({
    title: t('settings.title'),
    description: t('settings.description'),
})
</script>

<template>
    <NuxtLayout name="settings" :title="$t('settings.general.title')">
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

                <form
                    class="flex w-full flex-col gap-4"
                    @submit.prevent="profileForm.handleSubmit()"
                >
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
                        <UFormField
                            name="links"
                            :label="$t('settings.general.profile.links')"
                            :error="field.meta.isTouched ? getFormError(field.errors) : undefined"
                            class="w-full"
                        >
                            <SortableList
                                :model-value="field.value"
                                handle=".link-drag"
                                class="flex flex-col"
                                @update:model-value="field.handleChange"
                            >
                                <div
                                    v-for="(statelink, index) in field.value"
                                    :key="statelink"
                                    class="hover:bg-elevated flex items-center gap-2 rounded-md p-2 transition-colors"
                                >
                                    <Icon
                                        name="mingcute:dots-fill"
                                        size="18"
                                        class="link-drag text-muted shrink-0 cursor-move"
                                    />

                                    <UTooltip :text="statelink" :delay-duration="50">
                                        <Icon
                                            :name="useLinkAttributes(statelink).icon"
                                            size="18"
                                            class="text-toned shrink-0"
                                        />
                                    </UTooltip>

                                    <p class="line-clamp-1 text-sm leading-none break-all">
                                        {{ statelink }}
                                    </p>

                                    <UPopover :content="{ side: 'bottom' }">
                                        <UButton
                                            type="button"
                                            :aria-label="$t('settings.general.profile.editLink')"
                                            icon="mingcute:edit-2-fill"
                                            variant="ghost"
                                            size="sm"
                                            class="ml-auto"
                                            @click="editingLink = statelink"
                                        />

                                        <template #content="{ close }">
                                            <div class="flex max-w-96 items-center gap-2 p-2">
                                                <UInput
                                                    v-model="editingLink"
                                                    :placeholder="
                                                        $t('settings.general.profile.editLink')
                                                    "
                                                    class="w-full"
                                                    @keyup.enter.prevent="editLink(index, close)"
                                                />
                                                <UButton
                                                    type="button"
                                                    :label="$t('save')"
                                                    variant="soft"
                                                    color="neutral"
                                                    :disabled="!editingLink.trim()"
                                                    @click="editLink(index, close)"
                                                />
                                            </div>
                                        </template>
                                    </UPopover>
                                    <UButton
                                        type="button"
                                        :aria-label="$t('settings.general.profile.removeLink')"
                                        icon="mingcute:close-line"
                                        variant="ghost"
                                        size="sm"
                                        @click="removeLink(index)"
                                    />
                                </div>
                            </SortableList>

                            <div class="flex items-center gap-1">
                                <UPopover
                                    :content="{
                                        side: 'bottom',
                                    }"
                                >
                                    <UButton
                                        v-if="field.value.length < 8"
                                        type="button"
                                        icon="mingcute:add-line"
                                        :label="$t('settings.general.profile.addLink')"
                                        variant="ghost"
                                        block
                                        class="p-2"
                                    />

                                    <template #content>
                                        <div class="flex max-w-96 items-center gap-2 p-2">
                                            <UInput
                                                v-model="newLink"
                                                :placeholder="
                                                    $t('settings.general.profile.addLink')
                                                "
                                                class="w-full"
                                                @keyup.enter.prevent="addLink()"
                                            />
                                            <UButton
                                                type="button"
                                                :label="$t('add')"
                                                variant="soft"
                                                color="neutral"
                                                :disabled="!newLink.trim()"
                                                @click="addLink()"
                                            />
                                        </div>
                                    </template>
                                </UPopover>
                            </div>
                        </UFormField>
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

        <section id="display" class="flex flex-col gap-4">
            <h3 class="text-muted text-sm leading-none font-semibold text-nowrap">
                {{ $t('settings.general.display.title') }}
            </h3>

            <UCard :ui="{ body: 'flex flex-col gap-4' }">
                <USwitch
                    :label="$t('settings.general.display.showNSFW')"
                    color="neutral"
                    :default-value="userSettings?.showNSFW"
                    @update:modelValue="(value) => updateUserSettings({ showNSFW: value })"
                />
            </UCard>
        </section>

        <section id="site" class="flex flex-col gap-4">
            <h3 class="text-muted text-sm leading-none font-semibold text-nowrap">
                {{ $t('settings.general.site.title') }}
            </h3>

            <UCard>
                <div class="flex w-full flex-col gap-6">
                    <div class="flex w-full flex-col gap-3">
                        <UPageCard
                            :title="$t('settings.general.site.language')"
                            :description="$t('settings.general.site.languageDescription')"
                            orientation="horizontal"
                            variant="naked"
                        >
                            <ULocaleSelect
                                :model-value="locale"
                                :locales="[en, ja]"
                                variant="subtle"
                                color="neutral"
                                class="ml-auto w-fit min-w-48"
                                @update:model-value="setLocale($event as 'en' | 'ja')"
                            />
                        </UPageCard>

                        <UCard
                            v-if="locale !== 'ja'"
                            variant="soft"
                            :ui="{ body: 'flex flex-col items-start gap-3' }"
                        >
                            <p class="text-xs">
                                {{ $t('settings.general.site.improveTranslation') }}
                            </p>

                            <UButton
                                :to="`${app.repo}/blob/main/i18n/locales/${localeProperties.language}.json`"
                                target="_blank"
                                icon="mingcute:github-fill"
                                :label="$t('settings.general.site.editOnGitHub')"
                                variant="outline"
                                size="sm"
                            />
                        </UCard>
                    </div>

                    <UPageCard
                        :title="$t('settings.general.site.theme')"
                        :description="$t('settings.general.site.themeDescription')"
                        orientation="horizontal"
                        variant="naked"
                    >
                        <UColorModeSelect
                            variant="subtle"
                            color="neutral"
                            class="ml-auto w-fit min-w-48"
                        />
                    </UPageCard>
                </div>
            </UCard>
        </section>
    </NuxtLayout>
</template>
