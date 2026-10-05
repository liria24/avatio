<script lang="ts" setup>
definePageMeta({ auth: 'user', layout: 'compose' })

const route = useRoute()
const overlay = useOverlay()
const { t } = useI18n()
const {
    values,
    publish,
    reset,
    changed,
    editingSetupId,
    publishing,
    switchingAccount,
    imageUploading,
    draft,
    loadDraft,
    initialize,
    pointEditor,
    closeImagePoints,
    updateImagePoints,
    entries,
} = useSetupCompose()

const publishedSetupId = ref<Setup['id'] | null>(null)
const mobilePanel = ref<'details' | 'items'>('details')
const mobileTabs = computed(() => [
    {
        label: t('setup.compose.mobile.details'),
        value: 'details',
        icon: 'mingcute:edit-3-fill',
        slot: 'details' as const,
        ui: { content: 'flex flex-col gap-8' },
    },
    {
        label: t('setup.compose.mobile.items'),
        value: 'items',
        icon: 'mingcute:package-2-fill',
        slot: 'items' as const,
        ui: { content: 'flex min-h-[60vh] flex-col gap-4' },
    },
])
const setMobilePanel = (value: string | number) => {
    if (value === 'details' || value === 'items') mobilePanel.value = value
}
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
    <ModalSetupImagePoints
        v-if="pointEditor"
        :key="pointEditor.id"
        :open="true"
        :image-id="pointEditor.id"
        :image-url="pointEditor.url"
        :width="pointEditor.width"
        :height="pointEditor.height"
        :placing-entry-id="pointEditor.placingEntryId"
        :entries="entries"
        :points="values.points.filter((point) => point.imageId === pointEditor?.id)"
        :total-points="values.points.length"
        @update:open="closeImagePoints"
        @update:points="updateImagePoints(pointEditor.id, $event)"
    >
        <template #save-status>
            <UBadge
                v-if="statusBadge"
                :icon="statusBadge[0]"
                :label="statusBadge[1]"
                :color="statusBadge[2]"
                variant="soft"
                :ui="{ label: 'text-toned' }"
                data-testid="point-draft-status"
            />
        </template>
    </ModalSetupImagePoints>
    <UForm
        :state="values"
        :inert="switchingAccount"
        :aria-busy="switchingAccount"
        class="flex min-h-dvh flex-col items-center gap-5 p-6"
        @submit="onSubmit"
    >
        <header class="flex w-full flex-wrap items-center gap-4">
            <NuxtLinkLocale to="/">
                <AppLogo class="-mt-1.5 w-20 sm:w-24" aria-label="Avatio" />
            </NuxtLinkLocale>

            <h1 class="text-2xl font-bold">
                {{ editingSetupId ? $t('setup.compose.editTitle') : $t('setup.compose.title') }}
            </h1>

            <div
                class="flex w-full flex-wrap items-center justify-end gap-2 sm:ml-auto sm:w-auto sm:gap-3"
            >
                <SetupsComposeDraftsModal
                    :referenced-draft-id="draft.status === 'new' ? undefined : draft.id"
                    @load="loadDraft($event)"
                >
                    <UButton
                        :label="$t('setup.compose.draftButton')"
                        icon="mingcute:circle-dash-fill"
                        color="neutral"
                        variant="subtle"
                        size="sm"
                        :disabled="switchingAccount"
                        class="rounded-full"
                    />
                </SetupsComposeDraftsModal>

                <UBadge
                    v-if="statusBadge"
                    :icon="statusBadge[0]"
                    :label="statusBadge[1]"
                    :color="statusBadge[2]"
                    variant="soft"
                    :ui="{ label: 'text-toned' }"
                    class="rounded-full px-3"
                    data-testid="draft-status"
                />

                <UButton
                    type="submit"
                    :label="
                        editingSetupId
                            ? $t('setup.compose.updateButton')
                            : $t('setup.compose.publishButton')
                    "
                    icon="mingcute:upload-fill"
                    color="neutral"
                    :loading="publishing || switchingAccount"
                    :disabled="imageUploading || switchingAccount"
                    :ui="{ leadingIcon: 'size-5' }"
                    class="rounded-full px-4 py-2.5 sm:px-12"
                />
            </div>
        </header>
        <main class="flex min-h-0 w-full grow flex-col gap-6 px-1">
            <USplitter
                v-if="desktop"
                id="splitter-items"
                :items="[
                    {
                        slot: 'left',
                        minSize: 30,
                        defaultSize: 40,
                        class: 'ring ring-inset ring-muted/50 bg-elevated/30 rounded-xl flex flex-col gap-8 overflow-y-auto p-4 sm:p-6',
                    },
                    {
                        slot: 'right',
                        minSize: 30,
                        defaultSize: 60,
                        class: 'ring ring-inset ring-muted/50 bg-elevated/30 rounded-xl flex flex-col gap-4 overflow-hidden p-4 sm:p-6',
                    },
                ]"
                class="min-h-0 grow"
            >
                <template #left>
                    <SetupsComposeDetails />
                </template>
                <template #right>
                    <SetupsComposeItems />
                </template>
            </USplitter>

            <UTabs
                v-else
                :model-value="mobilePanel"
                :items="mobileTabs"
                :unmount-on-hide="false"
                activation-mode="manual"
                :ui="{
                    root: 'min-h-0 grow items-stretch gap-4',
                    list: 'grid grid-cols-2 gap-2 bg-transparent p-0',
                    indicator: 'hidden',
                    trigger:
                        'data-[state=active]:bg-primary data-[state=inactive]:bg-primary/10 data-[state=inactive]:text-primary hover:data-[state=inactive]:bg-primary/15',
                    content: 'grow rounded-xl p-1 data-[state=inactive]:hidden',
                }"
                @update:model-value="setMobilePanel"
            >
                <template #details>
                    <SetupsComposeDetails />
                </template>
                <template #items>
                    <SetupsComposeItems />
                </template>
            </UTabs>
        </main>
    </UForm>
</template>
