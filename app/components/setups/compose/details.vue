<script setup lang="ts">
const { user } = useUserSession()
const { data: sessions, load: loadSessions } = useDeviceSessions()
const { form, editingSetupId, imageUploading, switchingAccount, switchPostingAccount } =
    useSetupCompose()
const open = ref(false)

watch(open, async (value) => {
    if (value) await loadSessions()
})
</script>

<template>
    <div class="contents">
        <SetupsComposeEditingSetup v-if="editingSetupId" :setup-id="editingSetupId" />

        <div class="flex items-center gap-4">
            <UDropdownMenu
                v-model:open="open"
                :items="[
                    ...(sessions?.map((s) => ({
                        label: s.user.name,
                        disabled: switchingAccount || s.user.id === user?.id,
                        avatar: {
                            src: s.user.image || undefined,
                            alt: s.user.name,
                            icon: 'mingcute:user-3-fill',
                        },
                        onSelect: () => switchPostingAccount(s),
                    })) || []),
                ]"
            >
                <button
                    type="button"
                    :aria-label="$t('header.menu.switchAccount')"
                    :disabled="editingSetupId !== null || imageUploading || switchingAccount"
                    class="ring-accented size-12 cursor-pointer rounded-full ring-0 transition-all select-none hover:ring-4"
                >
                    <UAvatar
                        :src="user?.image || undefined"
                        :alt="user?.name"
                        icon="mingcute:user-3-fill"
                        class="size-12"
                    />
                </button>
            </UDropdownMenu>

            <form.Field v-slot="{ field }" name="name">
                <UFormField
                    name="name"
                    :label="$t('setup.compose.nameLabel')"
                    required
                    class="grow"
                >
                    <UInput
                        :model-value="field.value"
                        :placeholder="$t('setup.compose.namePlaceholder')"
                        autocomplete="off"
                        variant="none"
                        size="xl"
                        class="border-muted w-full border-b"
                        @blur="field.handleBlur"
                        @keydown.enter.prevent
                        @update:model-value="field.handleChange"
                    />
                </UFormField>
            </form.Field>
        </div>

        <SetupsComposeImages />

        <form.Field v-slot="{ field }" name="description">
            <UFormField name="description" :label="$t('setup.compose.descriptionLabel')">
                <UTextarea
                    :model-value="field.value"
                    :placeholder="$t('setup.compose.descriptionPlaceholder')"
                    autoresize
                    :rows="5"
                    variant="soft"
                    class="w-full"
                    @blur="field.handleBlur"
                    @update:model-value="field.handleChange"
                />
            </UFormField>
        </form.Field>

        <SetupsComposeTags />
        <SetupsComposeCoauthors />

        <form.Field v-slot="{ field }" name="public">
            <USwitch
                :model-value="!field.value"
                :label="$t('setup.compose.limitedPublic')"
                :description="$t('setup.compose.limitedPublicDescription')"
                color="neutral"
                :ui="{ description: 'text-xs mt-1' }"
                class="mt-auto"
                @update:model-value="(value) => field.handleChange(!value)"
            />
        </form.Field>
    </div>
</template>
