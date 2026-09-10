<script lang="ts" setup>
definePageMeta({ auth: 'user', layout: 'compose' })

const route = useRoute()
const overlay = useOverlay()
const { t } = useI18n()
const compose = useSetupCompose()
const {
    form,
    values,
    publish,
    reset,
    changed,
    editingSetupId,
    publishing,
    imageUploading,
    draft,
    loadDraft,
    initialize,
} = compose

const publishedSetupId = ref<Setup['id'] | null>(null)
const modalNewSetupConfirm = ref(false)
const mobilePanel = ref<'details' | 'items'>('details')
const desktop = useMediaQuery('(min-width: 1024px)', { ssrWidth: 1024 })
const publishCompleteModal = usePublishSetupCompleteModal()

const statusBadge = computed(() => {
    const badges = {
        restoring: [
            'svg-spinners:ring-resize',
            t('setup.compose.draftStatus.restoring'),
            'primary',
        ],
        restored: ['mingcute:refresh-2-fill', t('setup.compose.draftStatus.restored'), 'primary'],
        unsaved: ['mingcute:edit-3-fill', t('setup.compose.draftStatus.unsaved'), 'warning'],
        saving: ['svg-spinners:ring-resize', t('setup.compose.draftStatus.saving'), 'primary'],
        saved: ['mingcute:check-line', t('setup.compose.draftStatus.saved'), 'success'],
        error: ['mingcute:close-line', t('setup.compose.draftStatus.error'), 'error'],
        offline: ['mingcute:wifi-off-line', t('setup.compose.draftStatus.offline'), 'warning'],
        conflict: ['mingcute:warning-fill', t('setup.compose.draftStatus.conflict'), 'error'],
    } as const
    return draft.value.status === 'new' ? null : badges[draft.value.status]
})

const onSubmit = async () => {
    const setupId = await publish()
    if (!setupId) return
    publishedSetupId.value = setupId
    if ((await publishCompleteModal.open({ setupId })) === 'continue') await resetForm()
}

const resetForm = async () => {
    publishedSetupId.value = null
    await reset()
}

onBeforeRouteLeave((_to, _from, next) => {
    if (
        changed.value &&
        !publishedSetupId.value &&
        !['saved', 'restored'].includes(draft.value.status)
    )
        return next(window.confirm(t('setup.compose.confirmLeave')))
    overlay.closeAll()
    return next(true)
})

useSeo({
    title: editingSetupId.value ? t('setup.compose.editTitle') : t('setup.compose.title'),
    description: editingSetupId.value
        ? t('setup.compose.seoEditDescription')
        : t('setup.compose.seoDescription'),
})

const queryValue = (value: unknown) =>
    Array.isArray(value) ? value[0]?.toString() : value ? String(value) : undefined
await initialize({ draftId: queryValue(route.query.draftId), edit: queryValue(route.query.edit) })
</script>

<template>
    <UForm :state="values" class="flex size-full min-h-0 flex-col gap-6 px-1" @submit="onSubmit">
        <div class="flex items-center gap-3">
            <h1 class="mr-auto text-2xl font-bold">
                {{ editingSetupId ? $t('setup.compose.editTitle') : $t('setup.compose.title') }}
            </h1>

            <SetupsComposeDraftsModal
                :referenced-draft-id="draft.status === 'new' ? undefined : draft.id"
                @load="loadDraft($event)"
            >
                <UButton
                    :label="$t('setup.compose.draftButton')"
                    icon="mingcute:circle-dash-fill"
                    variant="subtle"
                    size="sm"
                    class="rounded-full"
                />
            </SetupsComposeDraftsModal>

            <UBadge
                v-if="statusBadge"
                :icon="statusBadge[0]"
                :label="statusBadge[1]"
                :color="statusBadge[2]"
                variant="soft"
                class="rounded-full px-3"
                data-testid="draft-status"
            />

            <UModal
                v-model:open="modalNewSetupConfirm"
                :title="$t('setup.compose.newSetupModal.title')"
            >
                <UButton
                    v-if="changed"
                    :disabled="
                        draft.status === 'unsaved' || draft.status === 'saving' || publishing
                    "
                    :aria-label="$t('setup.compose.newSetup')"
                    icon="mingcute:add-line"
                    variant="soft"
                    color="neutral"
                    :ui="{ leadingIcon: 'size-4' }"
                    class="rounded-full"
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
                    <UButton
                        :label="$t('setup.compose.newSetupCreate')"
                        variant="soft"
                        class="ml-auto"
                        @click="resetForm().then(() => (modalNewSetupConfirm = false))"
                    />
                </template>
            </UModal>

            <UButton
                type="submit"
                :label="
                    editingSetupId
                        ? $t('setup.compose.updateButton')
                        : $t('setup.compose.publishButton')
                "
                icon="mingcute:upload-fill"
                color="neutral"
                :loading="publishing"
                :disabled="imageUploading"
                :ui="{ leadingIcon: 'size-5' }"
                class="rounded-full px-12 py-2.5"
            />
        </div>

        <USplitter
            v-if="desktop"
            id="splitter-items"
            :items="[
                {
                    slot: 'sidebar',
                    minSize: 30,
                    defaultSize: 40,
                    class: 'ring ring-inset ring-muted/50 bg-elevated/30 rounded-xl flex flex-col gap-8 overflow-y-auto p-4 sm:p-6',
                },
                {
                    slot: 'main',
                    minSize: 30,
                    defaultSize: 60,
                    class: 'ring ring-inset ring-muted/50 bg-elevated/30 rounded-xl flex flex-col gap-4 overflow-hidden p-4 sm:p-6',
                },
            ]"
            class="min-h-0 grow"
        >
            <template #sidebar><SetupsComposeDetails /></template>
            <template #main><SetupsComposeItems /></template>
        </USplitter>

        <div v-else class="flex min-h-0 grow flex-col gap-4">
            <div class="grid grid-cols-2 gap-2">
                <UButton
                    :label="$t('setup.compose.mobile.details')"
                    icon="mingcute:edit-3-fill"
                    :variant="mobilePanel === 'details' ? 'solid' : 'soft'"
                    block
                    @click="mobilePanel = 'details'"
                />
                <UButton
                    :label="$t('setup.compose.mobile.items')"
                    icon="mingcute:package-2-fill"
                    :variant="mobilePanel === 'items' ? 'solid' : 'soft'"
                    block
                    @click="mobilePanel = 'items'"
                />
            </div>
            <section
                v-show="mobilePanel === 'details'"
                class="flex grow flex-col gap-8 rounded-xl p-1"
            >
                <SetupsComposeDetails />
            </section>
            <section
                v-show="mobilePanel === 'items'"
                class="flex min-h-[60vh] grow flex-col gap-4 rounded-xl p-1"
            >
                <SetupsComposeItems />
            </section>
        </div>
    </UForm>
</template>
