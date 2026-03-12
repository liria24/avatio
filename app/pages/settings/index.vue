<script lang="ts" setup>
import { en, ja } from '@nuxt/ui/locale'

definePageMeta({
    middleware: 'authed',
})

const { app } = useAppConfig()
const { locale, setLocale } = useI18n()
const { t } = useI18n()
const toast = useToast()
const { auth, session, refreshSession } = useAuth()

const i18nFileLinks = {
    en: `${app.repo}/blob/main/i18n/en-US.ts`,
    ja: `${app.repo}/blob/main/i18n/ja-JP.ts`,
}

const updating = ref(false)
const username = ref(session.value!.user.username || '')
const name = ref(session.value!.user.name || '')
const bio = ref(session.value!.user.bio || '')
const links = ref([...(session.value!.user.links || [])])
const newLink = ref('')

const processImage = async (file: File) => {
    if (!username.value) return

    updating.value = true

    try {
        const imageUrl = await uploadImage(file, 'avatar')
        if (!imageUrl) return

        await auth.updateUser({ image: imageUrl })
    } catch (error) {
        console.error('Failed to upload image:', error)
    } finally {
        updating.value = false
    }
}

const saveProfile = async (data: Parameters<typeof auth.updateUser>[0]) => {
    try {
        await auth.updateUser(data)
        toast.add({
            id: 'profile-saved',
            icon: 'mingcute:check-line',
            title: t('settings.general.toast.profileSaved'),
            color: 'success',
        })
        await refreshSession()
    } catch (error) {
        console.error('Failed to save profile:', error)
        toast.add({
            id: 'profile-save-failed',
            icon: 'mingcute:close-line',
            title: t('settings.general.toast.saveFailed'),
            description: t('settings.general.toast.saveFailedDescription'),
            color: 'error',
        })
    }
}

const addLink = () => {
    const trimmedLink = newLink.value.trim()
    if (!trimmedLink) return false

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
        return false
    }

    if (links.value.includes(trimmedLink)) {
        toast.add({
            id: 'link-duplicate',
            icon: 'mingcute:warning-line',
            title: t('settings.general.toast.linkExists'),
            description: t('settings.general.toast.linkExistsDescription'),
            color: 'warning',
        })
        return false
    }

    links.value.push(trimmedLink)
    newLink.value = ''
    return true
}

const removeLink = (index: number) => {
    if (index < 0 || index >= links.value.length) return
    links.value.splice(index, 1)
}

const { open, reset, onChange } = useFileDialog({
    accept: 'image/png, image/jpg, image/jpeg, image/webp, image/tiff',
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
                        v-if="session?.user.image"
                        :src="session?.user.image"
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

                <div class="flex w-full flex-col gap-4">
                    <InputUsername
                        v-model="username"
                        :placeholder="$t('settings.general.profile.name')"
                    >
                        <template #trailing="{ available }">
                            <UButton
                                v-if="username !== session?.user.username"
                                :label="$t('save')"
                                color="neutral"
                                :disabled="!available || !username.trim()"
                                loading-auto
                                @click="saveProfile({ username })"
                            />
                        </template>
                    </InputUsername>

                    <UFormField
                        name="name"
                        :label="$t('settings.general.profile.name')"
                        :ui="{ container: 'flex items-center gap-1' }"
                        class="w-full"
                    >
                        <UInput
                            v-model="name"
                            :placeholder="$t('settings.general.profile.name')"
                            size="lg"
                            variant="subtle"
                            class="w-full"
                        />
                        <UButton
                            v-if="name.trim() !== session?.user.name"
                            :label="$t('save')"
                            size="lg"
                            color="neutral"
                            loading-auto
                            @click="saveProfile({ name: name.trim() })"
                        />
                    </UFormField>

                    <UFormField
                        name="bio"
                        :label="$t('settings.general.profile.bio')"
                        :ui="{ container: 'flex flex-col gap-1' }"
                        class="w-full"
                    >
                        <UTextarea
                            v-model="bio"
                            :placeholder="$t('settings.general.profile.bio')"
                            autoresize
                            variant="soft"
                            class="w-full"
                        />
                        <UButton
                            v-if="bio.trim() !== (session?.user.bio || '')"
                            :label="$t('save')"
                            color="neutral"
                            loading-auto
                            class="ml-auto"
                            @click="saveProfile({ bio: bio.trim() })"
                        />
                    </UFormField>

                    <UFormField
                        name="links"
                        :label="$t('settings.general.profile.links')"
                        class="w-full"
                    >
                        <ReorderGroup
                            v-model:values="links"
                            as="div"
                            axis="y"
                            class="flex flex-col"
                        >
                            <ReorderItem
                                v-for="(statelink, index) in links"
                                :key="statelink"
                                :value="statelink"
                                as="div"
                                class="hover:bg-elevated flex cursor-move items-center gap-2 rounded-md p-2 transition-colors"
                            >
                                <Icon
                                    name="mingcute:dots-fill"
                                    size="18"
                                    class="text-muted shrink-0"
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

                                <UButton
                                    :aria-label="$t('settings.general.profile.removeLink')"
                                    icon="mingcute:close-line"
                                    variant="ghost"
                                    size="sm"
                                    @click="removeLink(index)"
                                />
                            </ReorderItem>
                        </ReorderGroup>

                        <div class="flex items-center gap-1">
                            <UPopover
                                :content="{
                                    side: 'bottom',
                                }"
                            >
                                <UButton
                                    v-if="links.length < 8"
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
                                            :placeholder="$t('settings.general.profile.addLink')"
                                            class="w-full"
                                            @keyup.enter="addLink()"
                                        />
                                        <UButton
                                            :label="$t('add')"
                                            variant="soft"
                                            color="neutral"
                                            :disabled="!newLink.trim()"
                                            @click="addLink()"
                                        />
                                    </div>
                                </template>
                            </UPopover>
                            <UButton
                                v-if="
                                    JSON.stringify(links) !==
                                    JSON.stringify(session?.user.links || [])
                                "
                                :label="$t('save')"
                                color="neutral"
                                loading-auto
                                @click="saveProfile({ links })"
                            />
                        </div>
                    </UFormField>
                </div>
            </div>
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
                                :to="i18nFileLinks[locale]"
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
