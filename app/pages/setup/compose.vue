<script lang="ts" setup>
definePageMeta({
    middleware: 'session',
    layout: 'minimal',
})

const route = useRoute()

const {
    state,
    publish,
    reset,
    changed,
    editingSetupId,
    publishing,
    draft,
    loadDraft,
    initialize,
    skipDraftSave,
    saveDraft,
} = useSetupCompose()

// Watch for state changes and save draft
watch(
    state,
    () => {
        if (!skipDraftSave.value) {
            draft.value.status = 'unsaved'
            saveDraft()
        }
    },
    { deep: true, flush: 'post' }
)

const publishedSetupId = ref<number | null>(null)
const modalPublishComplete = ref(false)
const modalNewSetupConfirm = ref(false)

const { t } = useI18n()

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
}))

const onSubmit = async () => {
    const setupId = await publish()
    if (setupId) {
        publishedSetupId.value = setupId
        modalPublishComplete.value = true
    }
}

const resetForm = () => {
    modalPublishComplete.value = false
    publishedSetupId.value = null
    reset()
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
    return next(true)
})

defineSeo({
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
    edit: Array.isArray(edit) ? Number(edit[0]) : edit ? Number(edit) : undefined,
})
</script>

<template>
    <UForm :state class="relative size-full pb-5 lg:pl-92" @submit="onSubmit">
        <ModalPublishSetupComplete
            v-if="publishedSetupId"
            v-model:open="modalPublishComplete"
            :setup-id="publishedSetupId"
            @continue="resetForm"
        />

        <div
            :class="
                cn(
                    'ring-accented static top-0 bottom-4 left-0 flex flex-col overflow-y-auto rounded-lg',
                    'lg:absolute lg:w-88 lg:ring-2'
                )
            "
        >
            <div
                class="sticky top-0 right-0 left-0 z-1 hidden flex-col gap-2 p-5 backdrop-blur-lg lg:flex"
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

            <div class="flex flex-col gap-8 p-5 pt-2">
                <div
                    class="grid grid-flow-row gap-6 sm:grid-cols-2 lg:grid-flow-row lg:grid-cols-1"
                >
                    <div class="flex flex-col gap-4">
                        <SetupsComposeImages />

                        <UFormField name="name" :label="$t('setup.compose.nameLabel')" required>
                            <UInput
                                v-model="state.name"
                                :placeholder="$t('setup.compose.namePlaceholder')"
                                variant="subtle"
                                class="w-full"
                                @keydown.enter.prevent
                            />
                        </UFormField>

                        <UFormField
                            name="description"
                            :label="$t('setup.compose.descriptionLabel')"
                        >
                            <UTextarea
                                v-model="state.description"
                                :placeholder="$t('setup.compose.descriptionPlaceholder')"
                                autoresize
                                variant="soft"
                                class="w-full"
                            />
                        </UFormField>
                    </div>

                    <div class="flex flex-col gap-4">
                        <SetupsComposeTags />

                        <SetupsComposeCoauthors />
                    </div>
                </div>
            </div>

            <div
                class="static mt-auto flex w-full items-center justify-end gap-2 p-3 lg:sticky lg:bottom-0 lg:backdrop-blur-lg"
            >
                <UBadge
                    v-if="draft.status !== 'new'"
                    :icon="draftStatusBadge[draft.status].icon"
                    :label="draftStatusBadge[draft.status].label"
                    variant="soft"
                    :color="draft.status === 'error' ? 'error' : 'primary'"
                />

                <SetupsComposeDraftsModal
                    :referenced-draft-id="draft.id || undefined"
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

        <SetupsComposeItems v-model="state.items" />

        <UButton
            type="submit"
            icon="mingcute:upload-fill"
            :aria-label="$t('setup.compose.publishButton')"
            :loading="publishing"
            variant="solid"
            color="neutral"
            class="fixed right-4 bottom-4 rounded-full p-4 lg:hidden"
        />
    </UForm>
</template>
