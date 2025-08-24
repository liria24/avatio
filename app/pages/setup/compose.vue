<script lang="ts" setup>
import type { z } from 'zod'

definePageMeta({
    middleware: 'session',
})

const nuxtApp = useNuxtApp()
const router = useRouter()
const route = useRoute()
const toast = useToast()

const editingSetupId = ref<number | null>(null)

const publishing = ref(false)
const publishedSetupId = ref<number | null>(null)

const draftStatus = ref<
    'new' | 'restoring' | 'restored' | 'unsaved' | 'saving' | 'saved' | 'error'
>('new')
const referencedDraft = ref<string | null>(null)
const skipDraftSave = ref(false)

const modalPublishComplete = ref(false)
const modalNewSetupConfirm = ref(false)

const draftStatusBadge = {
    restoring: {
        icon: 'svg-spinners:ring-resize',
        label: '復元中...',
    },
    restored: {
        icon: 'lucide:refresh-cw',
        label: '復元しました',
    },
    unsaved: {
        icon: 'lucide:pen-line',
        label: '未保存の変更',
    },
    saving: {
        icon: 'svg-spinners:ring-resize',
        label: '保存中...',
    },
    saved: {
        icon: 'lucide:check',
        label: '保存しました',
    },
    error: {
        icon: 'lucide:x',
        label: '保存に失敗',
    },
}

type Schema = z.infer<typeof setupsClientFormSchema>
const state = reactive<Schema>({
    name: '',
    description: '',
    images: [],
    tags: [],
    coauthors: [],
    items: {
        avatar: [],
        clothing: [],
        accessory: [],
        hair: [],
        shader: [],
        texture: [],
        tool: [],
        other: [],
    },
})

const applyDraftData = async (content: SetupDraftContent) => {
    // 復元中は自動保存を抑止
    skipDraftSave.value = true

    state.name = content.name || ''
    state.description = content.description || ''
    // state.images = content.images || []
    state.images = []
    state.tags = content.tags ? content.tags.map((tag) => tag.tag) : []
    state.coauthors = content.coauthors
        ? await Promise.all(
              content.coauthors.map(async (coauthor) => {
                  const user = await $fetch<UserWithSetups>(
                      `/api/users/${coauthor.userId}`
                  )
                  return {
                      user: {
                          id: user.id,
                          createdAt: user.createdAt,
                          name: user.name,
                          image: user.image,
                          bio: user.bio,
                          links: user.links,
                      },
                      note: coauthor.note || '',
                  }
              })
          )
        : []

    // ここで content.items を元に state.items を復元する
    // state.items の各カテゴリに API から取得したアイテムデータを格納する
    // content.items は itemId と追加データのみを持つので、itemId を元に /api/items/:id から情報を取得してマージする
    // カテゴリキーは setupsClientFormSchema と一致させる
    state.items = {
        avatar: [],
        clothing: [],
        accessory: [],
        hair: [],
        shader: [],
        texture: [],
        tool: [],
        other: [],
    }

    if (content.items && content.items.length) {
        // 並行で取得して、失敗しても他は続行する
        const fetches = content.items.map(async (draftItem) => {
            try {
                const itemData = await $fetch<Item>(
                    `/api/items/${draftItem.itemId}`
                )

                return {
                    ...itemData,
                    id: itemData.id.toString(),
                    category: draftItem.category,
                    note: draftItem.note || '',
                    unsupported: draftItem.unsupported || false,
                    shapekeys: draftItem.shapekeys || [],
                }
            } catch (error) {
                console.error(`Failed to load item ${draftItem.itemId}:`, error)
                return null
            }
        })

        const results = await Promise.all(fetches)
        for (const res of results) {
            if (!res) continue

            // category が null/undefined の場合は "other" にフォールバック
            const category = res.category || 'other'
            const cat = category as keyof typeof state.items

            // カテゴリが有効でない場合も "other" に振る
            if (!state.items[cat]) {
                state.items.other.push({
                    ...res,
                    category: 'other',
                })
            } else {
                state.items[cat].push({
                    ...res,
                    category,
                })
            }
        }
    }

    // DOM / watcher の余計な発火を避けるため少し待機してから解除
    await nextTick()
    await new Promise((r) => setTimeout(r, 0))
    skipDraftSave.value = false
}

const loadDraft = async (draftId: string) => {
    try {
        draftStatus.value = 'restoring'

        const { drafts } = await $fetch('/api/setups/drafts', {
            query: { id: draftId },
            headers:
                import.meta.server && nuxtApp.ssrContext?.event.headers
                    ? nuxtApp.ssrContext.event.headers
                    : undefined,
        })

        if (!drafts.length || !drafts[0]) throw new Error('Draft not found')

        const draft = drafts[0]

        await applyDraftData(draft.content)
        referencedDraft.value = draft.id
        router.replace({
            query: {
                ...route.query,
                draftId: draft.id,
            },
        })
        draftStatus.value = 'restored'

        if (draft.setupId && editingSetupId.value !== draft.setupId) {
            editingSetupId.value = draft.setupId
            router.replace({
                query: {
                    ...route.query,
                    edit: draft.setupId,
                },
            })
        }
    } catch (error) {
        draftStatus.value = 'error'
        console.error('Failed to load draft:', error)
        toast.add({
            title: '下書きの読み込みに失敗しました',
            color: 'error',
        })
    }
}

const onSubmit = async () => {
    if (publishing.value) return

    try {
        publishing.value = true

        const validationResult = setupsClientFormSchema.safeParse(state)
        if (!validationResult.success) {
            console.error('Validation failed:', validationResult.error.issues)
            toast.add({
                title: 'セットアップの投稿に失敗しました',
                description: h(
                    resolveComponent('div'),
                    {
                        class: 'flex flex-col gap-1',
                    },
                    validationResult.error.issues.map((issue) =>
                        h(
                            resolveComponent('div'),
                            { class: 'text-xs' },
                            issue.message
                        )
                    )
                ),
                color: 'error',
            })
            return
        }

        const body = {
            name: state.name,
            description: state.description,
            items: Object.values(state.items)
                .flat()
                .map((item) => ({
                    itemId: item.id,
                    category: item.category,
                    note: item.note || undefined,
                    unsupported: item.unsupported || false,
                    shapekeys: item.shapekeys?.length
                        ? item.shapekeys
                        : undefined,
                })),
            images: state.images.length ? state.images : undefined,
            tags: state.tags.length
                ? state.tags.map((tag) => ({ tag }))
                : undefined,
            coauthors: state.coauthors.length
                ? state.coauthors.map((coauthor) => ({
                      userId: coauthor.user.id,
                      note: coauthor.note || undefined,
                  }))
                : undefined,
        }

        // 編集モードか新規作成かで分岐
        const isEditing = editingSetupId.value !== null
        const url = isEditing
            ? `/api/setups/${editingSetupId.value}`
            : '/api/setups'
        const method = isEditing ? 'PUT' : 'POST'

        const response = await $fetch<Setup>(url, {
            method,
            body,
        })

        if (referencedDraft.value)
            $fetch('/api/setups/drafts', {
                method: 'DELETE',
                query: { id: referencedDraft.value },
            })

        publishedSetupId.value = response.id
        modalPublishComplete.value = true
    } catch (error) {
        const isEditing = editingSetupId.value !== null
        console.error(
            isEditing ? 'Failed to update setup:' : 'Failed to submit setup:',
            error
        )

        toast.add({
            title: isEditing
                ? 'セットアップの更新に失敗しました'
                : 'セットアップの投稿に失敗しました',
            color: 'error',
        })
    } finally {
        publishing.value = false
    }
}

const resetForm = () => {
    modalPublishComplete.value = false

    skipDraftSave.value = false
    state.name = ''
    state.description = ''
    state.images = []
    state.tags = []
    state.coauthors = []
    state.items = {
        avatar: [],
        clothing: [],
        accessory: [],
        hair: [],
        shader: [],
        texture: [],
        tool: [],
        other: [],
    }
    skipDraftSave.value = true

    router.replace({
        query: {},
    })

    editingSetupId.value = null
    publishedSetupId.value = null
}

const saveDraftDebounce = useDebounceFn(async () => {
    if (skipDraftSave.value) {
        // 復元直後は保存しない
        draftStatus.value = 'restored'
        return
    }

    draftStatus.value = 'saving'

    const items = Object.values(state.items)
        .flat()
        .map((item) => ({
            itemId: item.id,
            category: item.category,
            note: item.note || undefined,
            unsupported: item.unsupported || false,
            shapekeys: item.shapekeys?.length ? item.shapekeys : undefined,
        }))
    const content = {
        name: state.name.length ? state.name : undefined,
        description: state.description?.length ? state.description : undefined,
        // images: state.images.length ? state.images : undefined,
        tags: state.tags.length
            ? state.tags.map((tag) => ({ tag }))
            : undefined,
        coauthors: state.coauthors.length
            ? state.coauthors.map((coauthor) => ({
                  userId: coauthor.user.id,
                  note: coauthor.note || undefined,
              }))
            : undefined,
        items: items.length ? items : undefined,
    }

    try {
        const response = await $fetch('/api/setups/drafts', {
            method: 'POST',
            body: {
                id: referencedDraft.value ?? undefined,
                setupId: editingSetupId.value ?? undefined,
                content,
            },
        })
        referencedDraft.value = response.draftId
        router.replace({
            query: {
                ...route.query,
                draftId: response.draftId,
            },
        })

        draftStatus.value = 'saved'
    } catch (error) {
        console.error('Error saving draft:', error)
        draftStatus.value = 'error'
    }
}, 2000)

watch(
    state,
    () => {
        if (!skipDraftSave.value) {
            draftStatus.value = 'unsaved'
            saveDraftDebounce()
        }
    },
    { deep: true }
)

const enterEditModeAndRestoreDraft = async (args: {
    draftId?: string
    edit?: number
}) => {
    if (args.draftId) {
        await loadDraft(args.draftId)
    } else if (args.edit) {
        try {
            draftStatus.value = 'restoring'

            const { drafts } = await $fetch(`/api/setups/drafts`, {
                query: { setupId: args.edit },
                headers:
                    import.meta.server && nuxtApp.ssrContext?.event.headers
                        ? nuxtApp.ssrContext.event.headers
                        : undefined,
            })

            if (drafts.length && drafts[0]) {
                await applyDraftData(drafts[0].content)

                editingSetupId.value = args.edit
                referencedDraft.value = drafts[0].id
                router.replace({
                    query: {
                        ...route.query,
                        draftId: drafts[0].id,
                    },
                })
                draftStatus.value = 'restored'

                toast.add({
                    title: '編集途中の下書きが見つかったため復元されました',
                    color: 'secondary',
                })
                return
            }
        } catch (error) {
            console.warn('Error loading drafts:', error)
        }

        try {
            // 編集モードの場合、セットアップのデータを取得して状態に設定
            const setup = await $fetch<Setup>(`/api/setups/${args.edit}`)
            if (setup) {
                skipDraftSave.value = true

                state.name = setup.name
                state.description = setup.description || ''
                state.images = setup.images?.map((image) => image.url) || []
                state.tags = setup.tags || []
                state.coauthors = setup.coauthors || []
                for (const item of setup.items)
                    state.items[item.category].push({
                        ...item,
                        category: item.category,
                    })

                // 少し待ってから自動保存を再有効化
                await nextTick()
                await new Promise((r) => setTimeout(r, 0))
                skipDraftSave.value = false
                editingSetupId.value = setup.id
            } else {
                throw new Error()
            }
        } catch {
            console.error('Setup not found:', args.edit)
            toast.add({
                title: '編集モードを開始できませんでした',
                description: '指定されたセットアップが見つかりません。',
                color: 'error',
            })
        }
    }
}

const hasFormChanges = computed(() => {
    return (
        state.name.length ||
        state.description?.length ||
        state.images.length ||
        state.tags.length ||
        state.coauthors.length ||
        Object.values(state.items).some((items) => items.length)
    )
})

onBeforeRouteLeave((to, from, next) => {
    if (
        hasFormChanges.value &&
        !publishedSetupId.value &&
        draftStatus.value !== 'saved' &&
        draftStatus.value !== 'restored'
    ) {
        const answer = window.confirm(
            '入力された内容が破棄されます。よろしいですか？'
        )
        return next(answer)
    }
    return next(true)
})

defineSeo({
    title: editingSetupId.value ? 'セットアップを編集' : 'セットアップを投稿',
    description: editingSetupId.value
        ? 'セットアップの編集を行います。'
        : '新しいセットアップを投稿します。',
})

const draftId = route.query.draftId
const edit = route.query.edit

await enterEditModeAndRestoreDraft({
    draftId: Array.isArray(draftId)
        ? draftId[0]?.toString()
        : draftId
          ? draftId.toString()
          : undefined,
    edit: Array.isArray(edit)
        ? Number(edit[0])
        : edit
          ? Number(edit)
          : undefined,
})
</script>

<template>
    <UForm
        :state
        class="relative size-full pb-5 lg:pl-[23rem]"
        @submit="onSubmit"
    >
        <ModalPublishSetupComplete
            v-if="publishedSetupId"
            v-model:open="modalPublishComplete"
            :setup-id="publishedSetupId"
            @continue="resetForm"
        />

        <div
            :class="
                cn(
                    'ring-accented relative top-0 bottom-4 left-0 flex flex-col overflow-y-auto rounded-lg',
                    'lg:absolute lg:w-[22rem] lg:ring-2'
                )
            "
        >
            <div
                class="sticky top-0 right-0 left-0 z-[1] hidden flex-col gap-2 p-5 backdrop-blur-lg lg:flex"
            >
                <div class="flex items-center gap-2">
                    <UButton
                        type="submit"
                        :label="editingSetupId ? '更新' : '公開'"
                        icon="lucide:upload"
                        color="neutral"
                        block
                        :loading="publishing"
                        :ui="{ leadingIcon: 'size-4.5' }"
                        class="rounded-full p-3"
                    />

                    <UModal
                        v-model:open="modalNewSetupConfirm"
                        title="新規作成"
                    >
                        <UButton
                            v-if="hasFormChanges"
                            :disabled="
                                draftStatus === 'unsaved' ||
                                draftStatus === 'saving' ||
                                publishing
                            "
                            icon="lucide:plus"
                            variant="soft"
                            color="neutral"
                            :ui="{ leadingIcon: 'size-4.5' }"
                            class="rounded-full p-3"
                        />

                        <template #body>
                            <UAlert
                                title="新しいセットアップを作成しますか？"
                                :description="
                                    draftStatus === 'error'
                                        ? 'エラーにより下書きが保存されていません！'
                                        : '現在の状態は下書きに保存されています'
                                "
                                :color="
                                    draftStatus === 'error'
                                        ? 'error'
                                        : 'neutral'
                                "
                                variant="outline"
                            />
                        </template>

                        <template #footer>
                            <div class="flex w-full justify-end gap-2">
                                <UButton
                                    label="新規作成"
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

                <SetupsComposeEditingSetup
                    v-if="editingSetupId"
                    :setup-id="editingSetupId"
                />
            </div>

            <div class="flex flex-col gap-8 p-5 pt-2">
                <div
                    class="grid grid-flow-row gap-6 sm:grid-cols-2 lg:grid-flow-row lg:grid-cols-1"
                >
                    <div class="flex flex-col gap-4">
                        <SetupsComposeImages v-model="state.images" />

                        <UFormField name="name" label="タイトル" required>
                            <UInput
                                v-model="state.name"
                                placeholder="セットアップ名"
                                variant="subtle"
                                class="w-full"
                                @keydown.enter.prevent
                            />
                        </UFormField>

                        <UFormField name="description" label="説明">
                            <UTextarea
                                v-model="state.description"
                                placeholder="説明"
                                autoresize
                                variant="soft"
                                class="w-full"
                            />
                        </UFormField>
                    </div>

                    <div class="flex flex-col gap-4">
                        <SetupsComposeTags v-model="state.tags" />

                        <SetupsComposeCoauthors v-model="state.coauthors" />
                    </div>
                </div>
            </div>

            <div
                class="absolute bottom-0 flex w-full items-center justify-end gap-2 p-3 backdrop-blur-lg"
            >
                <UBadge
                    v-if="draftStatus !== 'new'"
                    :icon="draftStatusBadge[draftStatus].icon"
                    :label="draftStatusBadge[draftStatus].label"
                    variant="soft"
                    :color="draftStatus === 'error' ? 'error' : 'primary'"
                />

                <SetupsComposeDraftsModal
                    :referenced-draft-id="referencedDraft || undefined"
                    @load="loadDraft($event)"
                >
                    <UButton
                        label="下書き"
                        icon="lucide:circle-dashed"
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
            icon="lucide:upload"
            aria-label="セットアップを投稿"
            :loading="publishing"
            variant="solid"
            color="neutral"
            class="fixed right-4 bottom-4 rounded-full p-4 lg:hidden"
        />
    </UForm>
</template>
