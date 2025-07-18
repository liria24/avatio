<script lang="ts" setup>
import type { z } from 'zod/v4'
import { h, resolveComponent } from 'vue'

definePageMeta({
    middleware: 'session',
})

const router = useRouter()
const route = useRoute()
const toast = useToast()

const editingSetupId = ref<number | null>(null)
const publishing = ref(false)
const publishedSetupId = ref<number | null>(null)
const modalPublishComplete = ref(false)

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

const edit = route.query.edit

if (edit) {
    const setupId = Array.isArray(edit) ? edit[0] : edit
    if (setupId) {
        // 編集モードの場合、セットアップのデータを取得して状態に設定
        const setup = await $fetch<Setup>(`/api/setups/${setupId}`)
        if (setup) {
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

            editingSetupId.value = setup.id
        } else {
            console.error('Setup not found:', setupId)
            toast.add({
                title: '編集モードを開始できませんでした',
                description: '指定されたセットアップが見つかりません。',
                color: 'error',
            })
        }
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
    editingSetupId.value = null
    publishedSetupId.value = null
}

onBeforeRouteLeave((to, from, next) => {
    const hasChanges =
        state.name ||
        state.description ||
        state.images.length ||
        state.tags.length ||
        state.coauthors.length ||
        Object.values(state.items).some((items) => items.length)

    if (hasChanges && !publishedSetupId.value) {
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
                class="sticky top-0 right-0 left-0 z-[1] hidden items-center gap-1 p-5 lg:flex"
            >
                <UButton
                    type="submit"
                    :label="editingSetupId ? '更新' : '公開'"
                    icon="lucide:upload"
                    color="neutral"
                    size="sm"
                    block
                    :loading="publishing"
                    class="rounded-full p-3"
                />

                <UButton
                    icon="lucide:trash"
                    variant="ghost"
                    size="sm"
                    class="rounded-full p-3"
                    @click="router.back()"
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
