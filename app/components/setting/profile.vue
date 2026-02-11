<script lang="ts" setup>
interface Props {
    sectionId: string
}
const { sectionId } = defineProps<Props>()

const { state, save, image, link, updating, syncProfileData } = useUserSettingsProfile()
const { open } = image.select()
const { session } = useAuth()
const username = computed(() => session.value?.user.username || '')

const newLink = ref('')

watch(
    username,
    async (currentUsername, oldUsername) => {
        if (!currentUsername || currentUsername !== oldUsername)
            await syncProfileData(currentUsername || null)
    },
    { immediate: true }
)

const addLink = () => {
    const success = link.add(newLink.value)
    if (success) newLink.value = ''
}
</script>

<template>
    <section :id="sectionId" class="flex flex-col gap-4">
        <h2 class="text-muted text-sm leading-none font-semibold text-nowrap">
            {{ $t('settings.profile.title') }}
        </h2>
        <UForm :state="state" :schema="userUpdateSchema" @submit="save()">
            <UCard>
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
                                :label="$t('settings.profile.selectImage')"
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
                                        onSelect: () => {
                                            image.remove()
                                        },
                                    },
                                ]"
                            >
                                <UButton
                                    :aria-label="$t('settings.profile.moreOptions')"
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
                            v-model="state.username"
                            :placeholder="$t('settings.profile.name')"
                        />

                        <UFormField name="name" :label="$t('settings.profile.name')" class="w-full">
                            <UInput
                                v-model="state.name"
                                :placeholder="$t('settings.profile.name')"
                                size="lg"
                                variant="subtle"
                                class="w-full"
                            />
                        </UFormField>

                        <UFormField name="bio" :label="$t('settings.profile.bio')" class="w-full">
                            <UTextarea
                                v-model="state.bio"
                                :placeholder="$t('settings.profile.bio')"
                                autoresize
                                variant="soft"
                                class="w-full"
                            />
                        </UFormField>

                        <UFormField
                            name="links"
                            :label="$t('settings.profile.links')"
                            class="w-full"
                        >
                            <ReorderGroup
                                v-model:values="state.links"
                                as="div"
                                axis="y"
                                class="flex flex-col"
                            >
                                <ReorderItem
                                    v-for="(statelink, index) in state.links"
                                    :key="statelink"
                                    :value="statelink"
                                    as="div"
                                    class="hover:bg-elevated flex cursor-move items-center gap-2 rounded-md p-3 transition-colors"
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
                                        :aria-label="$t('settings.profile.removeLink')"
                                        icon="mingcute:close-line"
                                        variant="ghost"
                                        size="sm"
                                        @click="link.remove(index)"
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
                                    :label="$t('settings.profile.addLink')"
                                    variant="ghost"
                                    block
                                    class="p-2"
                                />

                                <template #content>
                                    <div class="flex max-w-96 items-center gap-2 p-2">
                                        <UInput
                                            v-model="newLink"
                                            :placeholder="$t('settings.profile.addLink')"
                                            class="w-full"
                                            @keyup.enter="addLink"
                                        />
                                        <UButton
                                            :label="$t('add')"
                                            variant="soft"
                                            :disabled="!newLink.trim()"
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
                            :loading="updating"
                            type="submit"
                            :label="$t('save')"
                            color="neutral"
                            block
                            class="w-full max-w-32"
                        />
                    </div>
                </template>
            </UCard>
        </UForm>
    </section>
</template>
