<script lang="ts" setup>
const open = defineModel<boolean>('open', { default: false })

interface Props {
    referencedDraftId?: string
}
const props = defineProps<Props>()

const emit = defineEmits(['load'])

const { drafts, draftsStatus, refreshDrafts, deleteDrafts: deleteDraftsApi } = useSetupCompose()

const deleteMode = ref(false)
const selectedDrafts = ref<string[]>([])
const deleting = ref(false)

const deleteDrafts = async () => {
    if (selectedDrafts.value.length === 0) return

    deleting.value = true

    try {
        await deleteDraftsApi(selectedDrafts.value)
    } finally {
        selectedDrafts.value = []
        deleting.value = false
    }
}

watch(open, (value) => {
    if (value) {
        deleteMode.value = false
        refreshDrafts()
    }
})

watch(deleteMode, (value) => {
    if (value) selectedDrafts.value = []
})
</script>

<template>
    <UModal v-model:open="open" title="下書き" description="最大で 32 件まで保存できます">
        <slot />

        <template #body>
            <div class="flex w-full flex-col gap-2">
                <div class="flex w-full items-center gap-2">
                    <UBadge
                        v-if="draftsStatus === 'pending'"
                        icon="svg-spinners:ring-resize"
                        label="取得中..."
                        variant="soft"
                    />

                    <span
                        class="text-muted grow py-1 pr-1 text-right font-mono text-sm leading-none text-nowrap"
                    >
                        {{ drafts.length }} / 32
                    </span>
                </div>

                <UAlert
                    v-if="drafts.length >= 32"
                    title="保存できる下書きの上限に達しています"
                    description="新しい下書きを保存するには、既存の下書きを削除してください"
                    variant="subtle"
                    color="neutral"
                />

                <UCheckboxGroup
                    v-if="deleteMode"
                    v-model="selectedDrafts"
                    :items="
                        drafts.map((draft: any) => ({
                            value: draft.id,
                            label: draft.content?.name,
                            description: draft.content?.description || undefined,
                            items: draft.content?.items || [],
                            updatedAt: draft.updatedAt,
                        }))
                    "
                    variant="table"
                    color="neutral"
                    :ui="{ item: 'py-2' }"
                >
                    <template #label="{ item }">
                        <div class="flex w-full items-start gap-1">
                            <div class="flex grow flex-col gap-1">
                                <span
                                    :data-notitle="!item.label"
                                    class="data-[notitle=true]:text-dimmed text-left"
                                >
                                    {{ item.label || '無題' }}
                                </span>

                                <p
                                    v-if="item.description"
                                    class="text-muted line-clamp-2 text-left text-xs break-all"
                                >
                                    {{ item.description }}
                                </p>
                            </div>

                            <div class="flex flex-col items-end gap-1.5">
                                <NuxtTime
                                    :datetime="item.updatedAt"
                                    relative
                                    class="text-muted text-xs text-nowrap"
                                />
                                <div class="text-muted flex items-center gap-1">
                                    <Icon name="mingcute:package-2-fill" size="16" />
                                    <span class="font-mono text-xs">
                                        {{ item.items?.length || 0 }}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </template>
                    <template #description><span /></template>
                </UCheckboxGroup>

                <UFieldGroup v-else-if="drafts.length" orientation="vertical">
                    <UButton
                        v-for="draft in drafts"
                        :key="draft.id"
                        variant="outline"
                        color="neutral"
                        @click="
                            () => {
                                emit('load', draft.id)
                                open = false
                            }
                        "
                    >
                        <div class="flex w-full items-start gap-1 p-1">
                            <div class="flex grow flex-col gap-1">
                                <div class="flex items-center gap-1.5">
                                    <span
                                        v-if="draft.id === props.referencedDraftId"
                                        class="ring-muted text-muted flex rounded-full px-2.5 pt-1 pb-1.5 text-xs leading-none ring-1"
                                    >
                                        編集中
                                    </span>

                                    <span
                                        :data-notitle="!draft.content.name"
                                        class="data-[notitle=true]:text-dimmed text-left"
                                    >
                                        {{ draft.content.name || '無題' }}
                                    </span>
                                </div>

                                <p
                                    v-if="draft.content.description"
                                    class="text-muted line-clamp-2 text-left text-xs break-all"
                                >
                                    {{ draft.content.description }}
                                </p>
                            </div>

                            <div class="flex flex-col items-end gap-1.5">
                                <NuxtTime
                                    :datetime="draft.updatedAt"
                                    relative
                                    class="text-muted text-xs text-nowrap"
                                />
                                <div class="text-muted flex items-center gap-1">
                                    <Icon name="mingcute:package-2-fill" size="16" />
                                    <span class="font-mono text-xs">
                                        {{ draft.content.items?.length || 0 }}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </UButton>
                </UFieldGroup>

                <p v-else class="text-muted py-8 text-center text-sm">下書きがありません</p>
            </div>
        </template>

        <template v-if="drafts.length" #footer>
            <div v-if="deleteMode" class="flex w-full justify-between">
                <UButton
                    icon="mingcute:arrow-left-line"
                    label="戻る"
                    variant="ghost"
                    size="lg"
                    @click="deleteMode = false"
                />

                <UButton
                    :disabled="!selectedDrafts.length"
                    :loading="deleting"
                    icon="mingcute:delete-2-fill"
                    label="削除"
                    variant="subtle"
                    color="neutral"
                    size="lg"
                    @click="deleteDrafts"
                />
            </div>

            <div v-else class="flex w-full justify-end">
                <UButton
                    label="下書きを削除"
                    variant="ghost"
                    color="neutral"
                    size="lg"
                    @click="deleteMode = true"
                />
            </div>
        </template>
    </UModal>
</template>
