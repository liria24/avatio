import type { z } from 'zod'

export const useSetupCompose = () => {
    const route = useRoute()
    const router = useRouter()
    const toast = useToast()

    const publishing = ref(false)
    const editingSetupId = ref<number | null>(null)

    const draft = ref<{
        id: string | null
        status: 'new' | 'restoring' | 'restored' | 'unsaved' | 'saving' | 'saved' | 'error'
    }>({
        id: null,
        status: 'new',
    })
    const skipDraftSave = ref(false)

    type Schema = z.infer<typeof setupsClientFormSchema>

    const initializeItems = () => ({
        avatar: [],
        clothing: [],
        accessory: [],
        hair: [],
        shader: [],
        texture: [],
        tool: [],
        other: [],
    })

    const state = reactive<Schema>({
        name: '',
        description: '',
        images: [],
        tags: [],
        coauthors: [],
        items: initializeItems(),
    })

    const updateRouterQuery = (updates: Record<string, string | number | undefined>) => {
        router.replace({
            query: {
                ...route.query,
                ...updates,
            },
        })
    }

    const buildContent = () => {
        const items = Object.values(state.items)
            .flat()
            .map((item) => ({
                itemId: item.id,
                category: item.category,
                note: item.note || undefined,
                unsupported: item.unsupported || false,
                shapekeys: item.shapekeys?.length ? item.shapekeys : undefined,
            }))

        return {
            name: state.name.length ? state.name : undefined,
            description: state.description?.length ? state.description : undefined,
            images: state.images.length ? state.images : undefined,
            tags: state.tags.length ? state.tags.map((tag) => ({ tag })) : undefined,
            coauthors: state.coauthors.length
                ? state.coauthors.map((coauthor) => ({
                      userId: coauthor.userId,
                      note: coauthor.note || undefined,
                  }))
                : undefined,
            items: items.length ? items : undefined,
        }
    }

    const withDraftSaveSkip = async (fn: () => Promise<void>) => {
        skipDraftSave.value = true
        await fn()
        await nextTick()
        await new Promise((r) => setTimeout(r, 0))
        skipDraftSave.value = false
    }

    const applyDraftData = async (content: SetupDraftContent) => {
        await withDraftSaveSkip(async () => {
            state.name = content.name || ''
            state.description = content.description || ''
            state.images = content.images || []
            state.tags = content.tags ? content.tags.map((tag) => tag.tag) : []
            state.coauthors = content.coauthors
                ? await Promise.all(
                      content.coauthors.map(async (coauthor) => {
                          const user = await $fetch<Serialized<User>>(
                              `/api/users/${coauthor.userId}`
                          )
                          return {
                              userId: coauthor.userId,
                              user: {
                                  ...user,
                                  createdAt: new Date(user.createdAt),
                              },
                              note: coauthor.note || '',
                          }
                      })
                  )
                : []

            state.items = initializeItems()

            if (content.items?.length) {
                const results = await Promise.all(
                    content.items.map(async (draftItem) => {
                        try {
                            const itemData = await $fetch<Item>(
                                `/api/items/${transformItemId(draftItem.itemId).encode()}`
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
                )

                for (const item of results) {
                    if (!item) continue
                    const category = (item.category || 'other') as keyof typeof state.items
                    const targetCategory = state.items[category] ? category : 'other'
                    state.items[targetCategory].push({
                        ...item,
                        category: targetCategory,
                    })
                }
            }
        })
    }

    const loadDraft = async (draftId: string) => {
        try {
            draft.value.status = 'restoring'

            const { data: drafts } = await useFetch('/api/setups/drafts', {
                query: { id: draftId },
                default: () => [],
            })

            const draftData = drafts.value[0]
            if (!draftData) throw new Error('Draft not found')

            await applyDraftData(draftData.content)
            draft.value.id = draftData.id
            updateRouterQuery({ draftId: draftData.id })
            draft.value.status = 'restored'

            if (draftData.setupId && editingSetupId.value !== draftData.setupId) {
                editingSetupId.value = draftData.setupId
                updateRouterQuery({ edit: draftData.setupId })
            }
        } catch (error) {
            draft.value.status = 'error'
            console.error('Failed to load draft:', error)
            toast.add({
                title: '下書きの読み込みに失敗しました',
                color: 'error',
            })
        }
    }

    const loadSetup = async (setupId: number) => {
        await withDraftSaveSkip(async () => {
            const setup = await $fetch<Setup>(`/api/setups/${setupId}`)
            state.name = setup.name
            state.description = setup.description || ''
            state.images = setup.images?.map((image) => image.url) || []
            state.tags = setup.tags || []
            state.coauthors = setup.coauthors
                ? setup.coauthors.map((coauthor) => ({
                      userId: coauthor.user.id,
                      user: coauthor.user,
                      note: coauthor.note || '',
                  }))
                : []
            state.items = initializeItems()
            for (const item of setup.items) {
                state.items[item.category].push(item)
            }
            editingSetupId.value = setup.id
        })
    }

    const initialize = async (args: { draftId?: string; edit?: number }) => {
        if (args.draftId) {
            await loadDraft(args.draftId)
            return
        }

        if (args.edit) {
            try {
                const { data: drafts } = await useFetch('/api/setups/drafts', {
                    query: { setupId: args.edit },
                    default: () => [],
                })

                if (drafts.value.length && drafts.value[0]) {
                    draft.value.status = 'restoring'
                    await applyDraftData(drafts.value[0].content)
                    editingSetupId.value = args.edit
                    draft.value.id = drafts.value[0].id
                    updateRouterQuery({ draftId: drafts.value[0].id })
                    draft.value.status = 'restored'

                    toast.add({
                        title: '編集途中の下書きが見つかったため復元されました',
                        color: 'secondary',
                    })
                    return
                }
            } catch {
                console.warn('Error loading drafts')
            }

            try {
                await loadSetup(args.edit)
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

    const publish = async (): Promise<number | undefined> => {
        if (publishing.value) return

        try {
            publishing.value = true

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
                        shapekeys: item.shapekeys?.length ? item.shapekeys : undefined,
                    })),
                images: state.images.length ? state.images : undefined,
                tags: state.tags.length ? state.tags.map((tag) => ({ tag })) : undefined,
                coauthors: state.coauthors.length
                    ? state.coauthors.map((coauthor) => ({
                          userId: coauthor.userId,
                          username: coauthor.user.username,
                          note: coauthor.note || undefined,
                      }))
                    : undefined,
            }

            const validationResult = setupsInsertSchema.safeParse(body)
            if (!validationResult.success) {
                console.error('Validation failed:', validationResult.error.issues)
                throw new Error('Validation failed')
            }

            const isEditing = editingSetupId.value !== null
            const response = await $fetch<Setup>(
                isEditing ? `/api/setups/${editingSetupId.value}` : '/api/setups',
                {
                    method: isEditing ? 'PUT' : 'POST',
                    body,
                }
            )

            if (draft.value.id) {
                await $fetch('/api/setups/drafts', {
                    method: 'DELETE',
                    query: { id: draft.value.id },
                })
            }

            return response.id
        } catch (error) {
            const isEditing = editingSetupId.value !== null
            console.error(isEditing ? 'Failed to update setup:' : 'Failed to submit setup:', error)

            toast.add({
                title: isEditing
                    ? 'セットアップの更新に失敗しました'
                    : 'セットアップの投稿に失敗しました',
                description:
                    error instanceof Error && error.message === 'Validation failed'
                        ? 'ページを更新してもう一度お試しください。'
                        : undefined,
                color: 'error',
            })
        } finally {
            publishing.value = false
        }
    }

    const reset = () => {
        state.name = ''
        state.description = ''
        state.images = []
        state.tags = []
        state.coauthors = []
        state.items = initializeItems()

        router.replace({ query: {} })

        draft.value = {
            id: null,
            status: 'new',
        }
        editingSetupId.value = null
        skipDraftSave.value = false
    }

    const saveDraftDebounce = useDebounceFn(async () => {
        if (skipDraftSave.value || publishing.value) {
            if (skipDraftSave.value) draft.value.status = 'restored'
            return
        }

        draft.value.status = 'saving'

        try {
            const response = await $fetch('/api/setups/drafts', {
                method: 'POST',
                body: {
                    id: draft.value.id ?? undefined,
                    setupId: editingSetupId.value ?? undefined,
                    content: buildContent(),
                },
            })

            if (response?.draftId) {
                draft.value.id = response.draftId
                updateRouterQuery({ draftId: response.draftId })
                draft.value.status = 'saved'
            } else {
                draft.value.status = 'new'
            }
        } catch (error) {
            console.error('Error saving draft:', error)
            draft.value.status = 'error'
        }
    }, 2000)

    watch(
        state,
        () => {
            if (!skipDraftSave.value) {
                draft.value.status = 'unsaved'
                saveDraftDebounce()
            }
        },
        { deep: true }
    )

    const changed = computed(
        () =>
            state.name.length ||
            state.description?.length ||
            state.images.length ||
            state.tags.length ||
            state.coauthors.length ||
            Object.values(state.items).some((items) => items.length)
    )

    // Tags management
    const addTag = (tag: string) => {
        if (!tag.trim()) return

        if (state.tags.includes(tag)) {
            toast.add({
                title: 'タグを重複して追加することはできません',
                color: 'warning',
            })
            return
        }

        state.tags.push(tag)
    }

    const removeTag = (tag: string) => {
        const index = state.tags.indexOf(tag)
        if (index !== -1) state.tags.splice(index, 1)
    }

    // Coauthors management
    const addCoauthor = (user: SerializedUser) => {
        if (!user?.username) return

        if (state.coauthors.some((coauthor) => coauthor.user.username === user.username)) {
            toast.add({
                title: '共同作者を重複して追加することはできません',
                color: 'warning',
            })
            return
        }

        state.coauthors.push({
            userId: user.id,
            user,
            note: '',
        })
    }

    const removeCoauthor = (username: string) => {
        const index = state.coauthors.findIndex((coauthor) => coauthor.user.username === username)
        if (index !== -1) {
            state.coauthors.splice(index, 1)
        }
    }

    // Images management
    const addImage = (url: string) => {
        state.images.push(url)
    }

    const removeImage = (index: number) => {
        if (index >= 0 && index < state.images.length) state.images.splice(index, 1)
    }

    // Items management
    const totalItemsCount = computed(() =>
        Object.values(state.items).reduce((total, category) => total + category.length, 0)
    )

    const isItemAlreadyAdded = (itemId: string): boolean =>
        Object.values(state.items).some((category) => category.some((item) => item.id === itemId))

    const addItem = (item: Item) => {
        if (!item?.id || !item?.category) {
            console.error('Invalid item data')
            return
        }

        if (isItemAlreadyAdded(item.id)) {
            toast.add({
                title: 'アイテムはすでに追加されています',
                color: 'warning',
            })
            return
        }

        const itemCategory = item.category as keyof typeof state.items
        if (!(itemCategory in state.items)) {
            console.error('Invalid item category:', itemCategory)
            return
        }

        state.items[itemCategory].push({
            ...item,
            id: item.id.toString(),
            note: '',
            unsupported: false,
        })
    }

    const removeItem = (category: string, id: string) => {
        const categoryKey = category as keyof typeof state.items
        if (!(categoryKey in state.items)) {
            console.error('Invalid category for removal:', category)
            return
        }

        const categoryItems = state.items[categoryKey]
        const index = categoryItems.findIndex((item) => item.id === id)

        if (index !== -1) categoryItems.splice(index, 1)
        else console.error('Item not found for removal:', id)
    }

    const changeItemCategory = (id: string, newCategory: ItemCategory) => {
        const newCategoryKey = newCategory as keyof typeof state.items
        if (!(newCategoryKey in state.items)) {
            console.error('Invalid new category:', newCategory)
            return
        }

        for (const category of Object.keys(state.items) as (keyof typeof state.items)[]) {
            const categoryItems = state.items[category]
            const index = categoryItems.findIndex((item) => item.id === id)

            if (index !== -1) {
                const [item] = categoryItems.splice(index, 1)
                if (item) {
                    item.category = newCategory
                    state.items[newCategoryKey].push(item)
                    return
                }
            }
        }

        console.error('Item not found for category change:', id)
    }

    const addShapekey = (options: {
        category: string
        id: string
        name: string
        value: number
    }) => {
        const { category, id, name, value } = options
        const categoryKey = category as keyof typeof state.items

        if (!(categoryKey in state.items)) {
            console.error('Invalid category for shapekey addition:', category)
            return
        }

        const item = state.items[categoryKey].find((item) => item.id === id)
        if (!item) {
            console.error('Item not found for shapekey addition:', id)
            return
        }

        if (!item.shapekeys) item.shapekeys = []

        item.shapekeys.push({ name, value })
    }

    const removeShapekey = (options: { category: string; id: string; index: number }) => {
        const { category, id, index } = options

        const categoryKey = category as keyof typeof state.items

        if (!(categoryKey in state.items)) {
            console.error('Invalid category for shapekey removal:', category)
            return
        }

        const item = state.items[categoryKey].find((item) => item.id === id)
        if (!item?.shapekeys || index < 0 || index >= item.shapekeys.length) {
            console.error('Shapekey not found for removal:', id, index)
            return
        }

        item.shapekeys.splice(index, 1)
    }

    // Drafts management
    const {
        data: drafts,
        status: draftsStatus,
        refresh: refreshDrafts,
    } = useFetch('/api/setups/drafts', { default: () => [] })

    const deleteDrafts = async (draftIds: string[]) => {
        if (draftIds.length === 0) return

        await $fetch('/api/setups/drafts', {
            method: 'DELETE',
            query: { id: draftIds },
        })

        await refreshDrafts()
    }

    return {
        initialize,
        state,
        publish,
        reset,
        changed,
        editingSetupId,
        publishing,
        draft,
        loadDraft,
        // Tags
        addTag,
        removeTag,
        // Coauthors
        addCoauthor,
        removeCoauthor,
        // Images
        addImage,
        removeImage,
        // Items
        totalItemsCount,
        addItem,
        removeItem,
        changeItemCategory,
        addShapekey,
        removeShapekey,
        // Drafts
        drafts,
        draftsStatus,
        refreshDrafts,
        deleteDrafts,
    }
}
