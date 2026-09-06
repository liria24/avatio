<script lang="ts" setup>
definePageMeta({
    auth: 'user',
    layout: 'minimal',
})

const route = useRoute()
const overlay = useOverlay()
const { t } = useI18n()

const {
    form,
    values,
    publish,
    reset,
    changed,
    editingSetupId,
    publishing,
    draft,
    loadDraft,
    initialize,
} = useSetupCompose()

const publishedSetupId = ref<Setup['id'] | null>(null)
const modalNewSetupConfirm = ref(false)
const publishCompleteModal = usePublishSetupCompleteModal()

const draftStatusBadge = computed(() => ({
    restoring: {
        icon: 'svg-spinners:ring-resize',
        label: t('setup.compose.draftStatus.restoring'),
    },
    restored: {
        icon: 'mingcute:refresh-2-fill',
        label: t('setup.compose.draftStatus.restored'),
    },
    unsaved: {
        icon: 'mingcute:edit-3-fill',
        label: t('setup.compose.draftStatus.unsaved'),
    },
    saving: {
        icon: 'svg-spinners:ring-resize',
        label: t('setup.compose.draftStatus.saving'),
    },
    saved: {
        icon: 'mingcute:check-line',
        label: t('setup.compose.draftStatus.saved'),
    },
    error: {
        icon: 'mingcute:close-line',
        label: t('setup.compose.draftStatus.error'),
    },
    offline: {
        icon: 'mingcute:wifi-off-line',
        label: t('setup.compose.draftStatus.error'),
    },
    conflict: {
        icon: 'mingcute:warning-fill',
        label: t('setup.compose.draftStatus.error'),
    },
}))

const onSubmit = async () => {
    const setupId = await publish()
    if (!setupId) return
    publishedSetupId.value = setupId
    const result = await publishCompleteModal.open({ setupId })
    if (result === 'continue') await resetForm()
}

const resetForm = async () => {
    publishedSetupId.value = null
    await reset()
}

onBeforeRouteLeave((to, from, next) => {
    if (
        changed.value &&
        !publishedSetupId.value &&
        draft.value.status !== 'saved' &&
        draft.value.status !== 'restored'
    ) {
        const answer = window.confirm(t('setup.compose.confirmLeave'))
        return next(answer)
    }
    overlay.closeAll()
    return next(true)
})

useSeo({
    title: editingSetupId.value ? t('setup.compose.editTitle') : t('setup.compose.title'),
    description: editingSetupId.value
        ? t('setup.compose.seoEditDescription')
        : t('setup.compose.seoDescription'),
})

const draftId = route.query.draftId
const edit = route.query.edit

await initialize({
    draftId: Array.isArray(draftId)
        ? draftId[0]?.toString()
        : draftId
          ? draftId.toString()
          : undefined,
    edit: Array.isArray(edit) ? String(edit[0]) : edit ? String(edit) : undefined,
})
</script>

<template>
    <UForm :state="values" class="relative size-full pb-5 lg:pl-92" @submit="onSubmit">
        <div
            :class="
                cn(
                    'ring-accented static top-0 bottom-4 left-0 flex flex-col overflow-y-auto rounded-lg',
                    'scrollbar-thin scrollbar-thumb-(--ui-bg-accented) scrollbar-track-transparent',
                    'lg:absolute lg:w-88 lg:ring-2',
                )
            "
        >
            <div
                class="sticky inset-x-0 top-0 z-1 flex flex-col gap-2 p-2 backdrop-blur-lg lg:p-5 lg:pb-2"
            >
                <div class="flex items-center gap-2">
                    <UButton
                        type="submit"
                        :label="
                            editingSetupId
                                ? $t('setup.compose.updateButton')
                                : $t('setup.compose.publishButton')
                        "
                        icon="mingcute:upload-fill"
                        color="neutral"
                        block
                        :loading="publishing"
                        :ui="{ leadingIcon: 'size-4.5' }"
                        class="rounded-full p-3"
                    />

                    <UModal
                        v-model:open="modalNewSetupConfirm"
                        :title="$t('setup.compose.newSetupModal.title')"
                    >
                        <UButton
                            v-if="changed"
                            :disabled="
                                draft.status === 'unsaved' ||
                                draft.status === 'saving' ||
                                publishing
                            "
                            :aria-label="$t('setup.compose.newSetup')"
                            icon="mingcute:add-line"
                            variant="soft"
                            color="neutral"
                            :ui="{ leadingIcon: 'size-4.5' }"
                            class="rounded-full p-3"
                        />

                        <template #body>
                            <UAlert
                                :title="$t('setup.compose.newSetupConfirm')"
                                :description="
                                    draft.status === 'error'
                                        ? $t('setup.compose.draftAlert.errorNotSaved')
                                        : $t('setup.compose.draftAlert.currentlySaved')
                                "
                                :color="draft.status === 'error' ? 'error' : 'neutral'"
                                variant="outline"
                            />
                        </template>

                        <template #footer>
                            <div class="flex w-full justify-end gap-2">
                                <UButton
                                    :label="$t('setup.compose.newSetupCreate')"
                                    variant="soft"
                                    size="lg"
                                    @click="
                                        () => {
                                            resetForm()
                                            modalNewSetupConfirm = false
                                        }
                                    "
                                />
                            </div>
                        </template>
                    </UModal>
                </div>

                <SetupsComposeEditingSetup v-if="editingSetupId" :setup-id="editingSetupId" />
            </div>

            <div
                class="grid grow grid-flow-row gap-6 p-2 sm:grid-cols-2 lg:grid-cols-1 lg:grid-rows-[auto_1fr] lg:p-5"
            >
                <div class="flex flex-col gap-4">
                    <SetupsComposeImages />

                    <form.Field v-slot="{ field }" name="name">
                        <UFormField name="name" :label="$t('setup.compose.nameLabel')" required>
                            <UInput
                                :model-value="field.value"
                                :placeholder="$t('setup.compose.namePlaceholder')"
                                variant="subtle"
                                class="w-full"
                                @blur="field.handleBlur"
                                @keydown.enter.prevent
                                @update:model-value="field.handleChange"
                            />
                        </UFormField>
                    </form.Field>

                    <form.Field v-slot="{ field }" name="description">
                        <UFormField
                            name="description"
                            :label="$t('setup.compose.descriptionLabel')"
                        >
                            <UTextarea
                                :model-value="field.value"
                                :placeholder="$t('setup.compose.descriptionPlaceholder')"
                                autoresize
                                variant="soft"
                                class="w-full"
                                @blur="field.handleBlur"
                                @update:model-value="field.handleChange"
                            />
                        </UFormField>
                    </form.Field>
                </div>

                <div class="flex flex-col gap-4">
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
            </div>

            <div
                class="static flex w-full items-center justify-end gap-2 p-3 lg:sticky lg:bottom-0 lg:backdrop-blur-lg"
            >
                <UBadge
                    v-if="draft.status !== 'new'"
                    :icon="draftStatusBadge[draft.status].icon"
                    :label="draftStatusBadge[draft.status].label"
                    variant="soft"
                    :color="draft.status === 'error' ? 'error' : 'primary'"
                />

                <SetupsComposeDraftsModal
                    :referenced-draft-id="draft.status === 'new' ? undefined : draft.id"
                    @load="loadDraft($event)"
                >
                    <UButton
                        :label="$t('setup.compose.draftButton')"
                        icon="mingcute:circle-dash-fill"
                        variant="subtle"
                        size="sm"
                        :ui="{ leadingIcon: 'size-4' }"
                        class="rounded-full"
                    />
                </SetupsComposeDraftsModal>
            </div>
        </div>

        <USeparator class="my-8 lg:hidden" />

        <SetupsComposeItems />
    </UForm>
</template>
