import type { z } from 'zod'

type Schema = z.infer<typeof setupsClientFormSchema>

type DraftStatus = 'new' | 'restoring' | 'restored' | 'unsaved' | 'saving' | 'saved' | 'error'

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

export const useSetupCompose = () => {
    const route = useRoute()
    const router = useRouter()
    const toast = useToast()

    // State - using useState for cross-component sharing
    const publishing = useState('setup-compose-publishing', () => false)
    const editingSetupId = useState<number | null>('setup-compose-editing-id', () => null)
    const imageUploading = useState('setup-compose-image-uploading', () => false)
    const skipDraftSave = useState('setup-compose-skip-draft', () => false)

    const draft = useState<{ id: string | null; status: DraftStatus }>(
        'setup-compose-draft',
        () => ({
            id: null,
            status: 'new',
        })
    )

    const state = useState<Schema>('setup-compose-state', () => ({
        name: '',
        description: '',
        images: [],
        tags: [],
        coauthors: [],
        items: initializeItems(),
    }))

    // Utilities
    const updateRouterQuery = (updates: Record<string, string | number | undefined>) => {
        router.replace({ query: { ...route.query, ...updates } })
    }

    const applyDraftData = async (content: SetupDraftContent) => {
        state.value.name = content.name || ''
        state.value.description = content.description || ''
        state.value.images = content.images || []
        state.value.tags = content.tags ? content.tags.map((tag) => tag.tag) : []

        state.value.coauthors = content.coauthors
            ? await Promise.all(
                  content.coauthors.map(async (coauthor) => {
                      const user = await $fetch<Serialized<User>>(`/api/users/${coauthor.userId}`)
                      return {
                          userId: coauthor.userId,
                          user: { ...user, createdAt: new Date(user.createdAt) },
                          note: coauthor.note || '',
                      }
                  })
              )
            : []

        state.value.items = initializeItems()

        if (content.items?.length) {
            const items = await Promise.all(
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
                        console.error('Failed to load item:', draftItem.itemId, error)
                        return null
                    }
                })
            )

            for (const item of items) {
                if (!item) continue
                const category = (item.category || 'other') as keyof typeof state.value.items
                const targetCategory = state.value.items[category] ? category : 'other'
                state.value.items[targetCategory].push({ ...item, category: targetCategory })
            }
        }
    }

    // Load operations
    const loadDraft = async (draftId: string) => {
        try {
            draft.value.status = 'restoring'
            skipDraftSave.value = true

            const { data: drafts } = await useFetch('/api/setups/drafts', {
                query: { id: draftId },
                default: () => [],
                dedupe: 'defer',
            })

            const draftData = drafts.value[0]
            if (!draftData) throw new Error('Draft not found')

            await applyDraftData(draftData.content)
            draft.value.id = draftData.id
            updateRouterQuery({ draftId: draftData.id })

            if (draftData.setupId && editingSetupId.value !== draftData.setupId) {
                editingSetupId.value = draftData.setupId
                updateRouterQuery({ edit: draftData.setupId })
            }

            draft.value.status = 'restored'
        } catch (error) {
            draft.value.status = 'error'
            console.error('Failed to load draft:', error)
            toast.add({ title: '下書きの読み込みに失敗しました', color: 'error' })
            updateRouterQuery({ draftId: undefined })
        } finally {
            skipDraftSave.value = false
        }
    }

    const loadSetup = async (setupId: number) => {
        skipDraftSave.value = true
        try {
            const setup = await $fetch<Setup>(`/api/setups/${setupId}`)
            state.value.name = setup.name
            state.value.description = setup.description || ''
            state.value.images = setup.images?.map((image) => image.url) || []
            state.value.tags = setup.tags || []
            state.value.coauthors = setup.coauthors
                ? setup.coauthors.map((coauthor) => ({
                      userId: coauthor.user.id,
                      user: coauthor.user,
                      note: coauthor.note || '',
                  }))
                : []

            state.value.items = initializeItems()
            for (const item of setup.items) {
                const category = item.category as keyof typeof state.value.items
                if (category in state.value.items) {
                    state.value.items[category].push(item)
                } else {
                    console.warn('Invalid item category:', item.category)
                }
            }
            editingSetupId.value = setup.id
        } finally {
            skipDraftSave.value = false
        }
    }

    const initialize = async (args: { draftId?: string; edit?: number }) => {
        // Load from draft
        if (args.draftId) {
            await loadDraft(args.draftId)
            return
        }

        // Edit mode
        if (args.edit) {
            // Check for existing draft
            try {
                const { data: drafts } = await useFetch('/api/setups/drafts', {
                    query: { setupId: args.edit },
                    default: () => [],
                    dedupe: 'defer',
                })

                if (drafts.value.length && drafts.value[0]) {
                    draft.value.status = 'restoring'
                    skipDraftSave.value = true
                    await applyDraftData(drafts.value[0].content)
                    editingSetupId.value = args.edit
                    draft.value.id = drafts.value[0].id
                    updateRouterQuery({ draftId: drafts.value[0].id })
                    draft.value.status = 'restored'
                    skipDraftSave.value = false

                    toast.add({
                        title: '編集途中の下書きが見つかったため復元されました',
                        color: 'secondary',
                    })
                    return
                }
            } catch (error) {
                console.warn('Failed to load drafts:', error)
            }

            // Load setup
            try {
                await loadSetup(args.edit)
            } catch (error) {
                console.error('Setup not found:', args.edit, error)
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

        publishing.value = true
        try {
            const items = Object.values(state.value.items)
                .flat()
                .filter((item) => item?.id)
                .map((item) => ({
                    itemId: item.id,
                    category: item.category,
                    note: item.note || undefined,
                    unsupported: item.unsupported || false,
                    shapekeys: item.shapekeys?.length ? item.shapekeys : undefined,
                }))

            const body = {
                name: state.value.name,
                description: state.value.description,
                items,
                images: state.value.images.length ? state.value.images : undefined,
                tags: state.value.tags.length
                    ? state.value.tags.map((tag) => ({ tag }))
                    : undefined,
                coauthors: state.value.coauthors.length
                    ? state.value.coauthors.map((c) => ({
                          userId: c.userId,
                          username: c.user.username,
                          note: c.note || undefined,
                      }))
                    : undefined,
            }

            if (import.meta.dev) console.log('Publishing setup:', body)

            const validationResult = setupsInsertSchema.safeParse(body)
            if (!validationResult.success) {
                console.error('Validation failed:', validationResult.error.issues)
                throw new Error('Validation failed')
            }

            const isEditing = editingSetupId.value !== null
            const response = await $fetch<Setup>(
                isEditing ? `/api/setups/${editingSetupId.value}` : '/api/setups',
                { method: isEditing ? 'PUT' : 'POST', body }
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
        state.value.name = ''
        state.value.description = ''
        state.value.images = []
        state.value.tags = []
        state.value.coauthors = []
        state.value.items = initializeItems()
        draft.value = { id: null, status: 'new' }
        editingSetupId.value = null
        skipDraftSave.value = false
        router.replace({ query: {} })
    }

    const saveDraft = useDebounceFn(async () => {
        if (skipDraftSave.value || publishing.value) {
            if (skipDraftSave.value) draft.value.status = 'restored'
            return
        }

        draft.value.status = 'saving'
        try {
            const items = Object.values(state.value.items)
                .flat()
                .filter((item) => item?.id)
                .map((item) => ({
                    itemId: item.id,
                    category: item.category,
                    note: item.note || undefined,
                    unsupported: item.unsupported || false,
                    shapekeys: item.shapekeys?.length ? item.shapekeys : undefined,
                }))

            const content: SetupDraftContent = {
                name: state.value.name || undefined,
                description: state.value.description || undefined,
                images: state.value.images.length ? state.value.images : undefined,
                tags: state.value.tags.length
                    ? state.value.tags.map((tag) => ({ tag }))
                    : undefined,
                coauthors: state.value.coauthors.length
                    ? state.value.coauthors
                          .filter((c) => c.userId)
                          .map((c) => ({ userId: c.userId, note: c.note || undefined }))
                    : undefined,
                items: items.length ? items : undefined,
            }

            const response = await $fetch('/api/setups/drafts', {
                method: 'POST',
                body: {
                    id: draft.value.id ?? undefined,
                    setupId: editingSetupId.value ?? undefined,
                    content,
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

    const changed = computed(() =>
        Boolean(
            state.value.name.length ||
            state.value.description?.length ||
            state.value.images.length ||
            state.value.tags.length ||
            state.value.coauthors.length ||
            Object.values(state.value.items).some((items) => items.length)
        )
    )

    // Tags
    const addTag = (tag: string) => {
        if (!tag.trim()) return

        if (state.value.tags.includes(tag)) {
            toast.add({ title: 'タグを重複して追加することはできません', color: 'warning' })
            return
        }

        state.value.tags.push(tag)
    }

    const removeTag = (tag: string) => {
        const index = state.value.tags.indexOf(tag)
        if (index !== -1) state.value.tags.splice(index, 1)
    }

    // Coauthors
    const addCoauthor = (user: SerializedUser) => {
        if (!user?.username) return

        if (state.value.coauthors.some((c) => c.user.username === user.username)) {
            toast.add({ title: '共同作者を重複して追加することはできません', color: 'warning' })
            return
        }

        state.value.coauthors.push({ userId: user.id, user, note: '' })
    }

    const removeCoauthor = (username: string) => {
        const index = state.value.coauthors.findIndex((c) => c.user.username === username)
        if (index !== -1) state.value.coauthors.splice(index, 1)
    }

    // Images
    const processImages = async (files: FileList | File[] | null) => {
        if (!files?.length) return

        const file = files[0]
        if (!file) return

        imageUploading.value = true
        try {
            const { uploadImage } = useUserSettings()
            const imageUrl = await uploadImage(file, 'setup')
            if (imageUrl) state.value.images.push(imageUrl)
        } finally {
            imageUploading.value = false
        }
    }

    const addImage = (url: string) => state.value.images.push(url)
    const removeImage = (index: number) => {
        if (index >= 0 && index < state.value.images.length) state.value.images.splice(index, 1)
    }

    // Items
    const totalItemsCount = computed(() =>
        Object.values(state.value.items).reduce((total, category) => total + category.length, 0)
    )

    const isItemAlreadyAdded = (itemId: string): boolean =>
        Object.values(state.value.items).some((category) =>
            category.some((item) => item.id === itemId)
        )

    const addItem = (item: Item) => {
        if (!item?.id || !item?.category) {
            console.error('Invalid item data:', item)
            return
        }

        if (isItemAlreadyAdded(item.id)) {
            toast.add({ title: 'アイテムはすでに追加されています', color: 'warning' })
            return
        }

        const itemCategory = item.category as keyof typeof state.value.items
        const targetCategory = itemCategory in state.value.items ? itemCategory : 'other'

        if (itemCategory !== targetCategory) {
            console.warn('Invalid item category, using other:', item.category)
        }

        state.value.items[targetCategory].push({
            ...item,
            id: item.id.toString(),
            category: targetCategory,
            note: '',
            unsupported: false,
        })
    }

    const removeItem = (category: string, id: string) => {
        const categoryKey = category as keyof typeof state.value.items
        if (!(categoryKey in state.value.items)) {
            console.error('Invalid category:', category)
            return
        }

        const index = state.value.items[categoryKey].findIndex((item) => item.id === id)
        if (index !== -1) {
            state.value.items[categoryKey].splice(index, 1)
        } else {
            console.warn('Item not found:', id)
        }
    }

    const changeItemCategory = (id: string, newCategory: ItemCategory) => {
        const newCategoryKey = newCategory as keyof typeof state.value.items
        if (!(newCategoryKey in state.value.items)) {
            console.error('Invalid new category:', newCategory)
            return
        }

        for (const category of Object.keys(
            state.value.items
        ) as (keyof typeof state.value.items)[]) {
            const index = state.value.items[category].findIndex((item) => item.id === id)
            if (index !== -1) {
                const [item] = state.value.items[category].splice(index, 1)
                if (item) {
                    item.category = newCategory
                    state.value.items[newCategoryKey].push(item)
                }
                return
            }
        }

        console.warn('Item not found:', id)
    }

    const addShapekey = (opts: { category: string; id: string; name: string; value: number }) => {
        const categoryKey = opts.category as keyof typeof state.value.items
        if (!(categoryKey in state.value.items)) {
            console.error('Invalid category:', opts.category)
            return
        }

        const item = state.value.items[categoryKey].find((item) => item.id === opts.id)
        if (!item) {
            console.warn('Item not found:', opts.id)
            return
        }

        if (!item.shapekeys) item.shapekeys = []
        item.shapekeys.push({ name: opts.name, value: opts.value })
    }

    const removeShapekey = (opts: { category: string; id: string; index: number }) => {
        const categoryKey = opts.category as keyof typeof state.value.items
        if (!(categoryKey in state.value.items)) {
            console.error('Invalid category:', opts.category)
            return
        }

        const item = state.value.items[categoryKey].find((item) => item.id === opts.id)
        if (!item?.shapekeys || opts.index < 0 || opts.index >= item.shapekeys.length) {
            console.warn('Shapekey not found:', opts.id, opts.index)
            return
        }

        item.shapekeys.splice(opts.index, 1)
    }

    // Drafts
    const {
        data: drafts,
        status: draftsStatus,
        refresh: refreshDrafts,
    } = useFetch('/api/setups/drafts', { default: () => [], dedupe: 'defer' })

    const deleteDrafts = async (draftIds: string[]) => {
        if (!draftIds.length) return
        await $fetch('/api/setups/drafts', { method: 'DELETE', query: { id: draftIds } })
        await refreshDrafts()
    }

    return {
        // Core
        initialize,
        state,
        publish,
        reset,
        changed,
        editingSetupId,
        publishing,
        draft,
        loadDraft,
        skipDraftSave,
        saveDraft,
        // Tags
        addTag,
        removeTag,
        // Coauthors
        addCoauthor,
        removeCoauthor,
        // Images
        imageUploading,
        processImages,
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
