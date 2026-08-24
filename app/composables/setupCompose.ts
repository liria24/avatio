import type { z } from 'zod'

import type { SetupComposeEntry } from './setupComposeEntries'

type Schema = DeepNonNullable<z.infer<typeof setupsClientFormSchema>>

type DraftStatus = 'new' | 'restoring' | 'restored' | 'unsaved' | 'saving' | 'saved' | 'error'

export const useSetupCompose = () => {
    const route = useRoute()
    const router = useRouter()
    const toast = useToast()
    const { t } = useI18n()

    // State - using useState for cross-component sharing
    const publishing = useState('setup-compose-publishing', () => false)
    const editingSetupId = useState<Setup['id'] | null>('setup-compose-editing-id', () => null)
    const imageUploading = useState('setup-compose-image-uploading', () => false)
    const skipDraftSave = useState('setup-compose-skip-draft', () => false)
    const publishIdempotencyKey = useState('setup-compose-publish-idempotency-key', () =>
        crypto.randomUUID(),
    )
    const draftIdempotencyKey = useState('setup-compose-draft-idempotency-key', () =>
        crypto.randomUUID(),
    )
    const imageMetadata = useState<Record<string, SetupImageMetadata>>(
        'setup-compose-image-metadata',
        () => ({}),
    )

    const draft = useState<{ id: string | null; status: DraftStatus }>(
        'setup-compose-draft',
        () => ({
            id: null,
            status: 'new',
        }),
    )

    const state = useState<Schema>('setup-compose-state', () => ({
        public: true,
        name: '',
        description: '',
        images: [],
        tags: [],
        coauthors: [],
        entries: [],
    }))

    const entryState = computed({
        get: () => state.value.entries,
        set: (entries: SetupComposeEntry[]) => (state.value.entries = entries),
    })
    const {
        totalItemsCount,
        addItem,
        removeItem,
        changeItemCategory,
        addShapekey,
        removeShapekey,
    } = useSetupComposeEntries(entryState)
    const imageState = computed({
        get: () => state.value.images,
        set: (images: string[]) => (state.value.images = images),
    })
    const { getSelectedImageMetadata, processImages, removeImage } = useSetupComposeImages(
        imageState,
        imageMetadata,
        imageUploading,
    )

    // Utilities
    const updateRouterQuery = (updates: Record<string, string | number | undefined>) => {
        void router.replace({ query: { ...route.query, ...updates } })
    }

    const applyDraftData = async (content: SetupDraftContent) => {
        state.value.public = content.public ?? true
        state.value.name = content.name || ''
        state.value.description = content.description || ''
        state.value.images = content.images || []
        imageMetadata.value = content.imageMetadata || {}
        state.value.tags = content.tags ? content.tags.map((tag) => tag.tag) : []

        const coauthorResults = content.coauthors
            ? await Promise.all(
                  content.coauthors.map(async (coauthor) => {
                      try {
                          const user = await $fetch(`/api/users/${coauthor.username}`)
                          return {
                              userId: user.id,
                              user: {
                                  ...user,
                                  createdAt: new Date(user.createdAt ?? ''),
                                  name: user.name ?? '',
                                  image: user.image ?? '',
                              },
                              note: coauthor.note || '',
                          }
                      } catch {
                          console.error('Failed to load coauthor.')
                          return null
                      }
                  }),
              )
            : []

        state.value.coauthors = coauthorResults.filter(
            (c): c is NonNullable<typeof c> => c !== null,
        )

        state.value.entries = []

        if (content.items?.length) {
            const items = await Promise.all(
                content.items.map(async (draftItem) => {
                    try {
                        const itemData = await $fetch<Item>(`/api/items/${draftItem.itemId}`)
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
                }),
            )

            for (const item of items) {
                if (!item) continue
                const parsedCategory = itemCategorySchema.safeParse(item.category)
                const category = parsedCategory.success ? parsedCategory.data : 'other'
                state.value.entries.push({
                    ...item,
                    category,
                    image: item.image ?? '',
                    niceName: item.niceName ?? '',
                    price: item.price ?? '',
                    likes: item.likes ?? 0,
                    shop: item.shop ? { ...item.shop, image: item.shop.image ?? '' } : undefined,
                })
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
            toast.add({
                icon: 'mingcute:close-line',
                title: t('setup.compose.draftLoadFailed'),
                color: 'error',
            })
            updateRouterQuery({ draftId: undefined })
        } finally {
            skipDraftSave.value = false
        }
    }

    const loadSetup = async (setupId: Setup['id']) => {
        skipDraftSave.value = true
        try {
            const setup = await $fetch<Setup>(`/api/me/setups/${setupId}`)
            state.value.public = setup.public
            state.value.name = setup?.name || ''
            state.value.description = setup?.description || ''
            state.value.images = setup?.images?.map((image) => image.url) || []
            imageMetadata.value = Object.fromEntries(
                (setup?.images || []).map((image) => [
                    image.url,
                    {
                        objectKey: image.objectKey,
                        contentType: image.contentType ?? undefined,
                        size: image.size ?? undefined,
                        etag: image.etag ?? undefined,
                        width: image.width,
                        height: image.height,
                        themeColors: image.themeColors || null,
                    },
                ]),
            )
            state.value.tags = setup?.tags || []
            state.value.coauthors = setup?.coauthors
                ? setup.coauthors.map((coauthor) => ({
                      userId: coauthor.user.id,
                      user: {
                          ...coauthor.user,
                          name: coauthor.user.name ?? '',
                          image: coauthor.user.image ?? '',
                      },
                      note: coauthor.note || '',
                  }))
                : []

            state.value.entries = []
            for (const item of setup?.items || []) {
                const parsedCategory = itemCategorySchema.safeParse(item.category)
                const category = parsedCategory.success ? parsedCategory.data : 'other'
                if (category) {
                    state.value.entries.push({
                        ...item,
                        category,
                        image: item.image ?? '',
                        niceName: item.niceName ?? '',
                        price: item.price ?? '',
                        likes: item.likes ?? 0,
                        shop: item.shop
                            ? { ...item.shop, image: item.shop.image ?? '' }
                            : undefined,
                        shapekeys: item.shapekeys?.map((sk) => ({
                            name: sk.name,
                            value: sk.value,
                        })),
                        note: item.note ?? undefined,
                        unsupported: item.unsupported ?? undefined,
                    })
                }
            }
            editingSetupId.value = setup?.id || null
        } finally {
            skipDraftSave.value = false
        }
    }

    const initialize = async (args: { draftId?: string; edit?: Setup['id'] }) => {
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
                        icon: 'mingcute:back-line',
                        title: t('setup.compose.draftRestored'),
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
                    icon: 'mingcute:close-line',
                    title: t('setup.compose.editModeFailed'),
                    description: t('setup.compose.setupNotFound'),
                    color: 'error',
                })
            }
        }
    }

    const publish = async (): Promise<Setup['id'] | undefined> => {
        if (publishing.value) return

        publishing.value = true
        try {
            const items = state.value.entries
                .filter((item) => item?.id)
                .map((item) => ({
                    itemId: item.id,
                    category: item.category,
                    note: item.note || undefined,
                    unsupported: item.unsupported || false,
                    shapekeys: item.shapekeys?.length ? item.shapekeys : undefined,
                }))

            const body = {
                public: state.value.public,
                name: state.value.name,
                description: state.value.description,
                items,
                images: state.value.images.length ? state.value.images : undefined,
                imageMetadata: getSelectedImageMetadata(),
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
                {
                    method: isEditing ? 'PUT' : 'POST',
                    headers: isEditing
                        ? undefined
                        : { 'Idempotency-Key': publishIdempotencyKey.value },
                    body,
                },
            )

            if (draft.value.id) {
                await $fetch('/api/setups/drafts', {
                    method: 'DELETE',
                    query: { id: draft.value.id },
                })
            }

            const setupId = response.id
            reset()
            return setupId
        } catch (error) {
            const isEditing = editingSetupId.value !== null
            console.error(isEditing ? 'Failed to update setup:' : 'Failed to submit setup:', error)

            toast.add({
                icon: 'mingcute:close-line',
                title: isEditing
                    ? t('setup.compose.updateFailed')
                    : t('setup.compose.publishFailed'),
                description:
                    error instanceof Error && error.message === 'Validation failed'
                        ? t('setup.compose.refreshAndRetry')
                        : undefined,
                color: 'error',
            })
        } finally {
            publishing.value = false
        }
    }

    const reset = () => {
        state.value.public = true
        state.value.name = ''
        state.value.description = ''
        state.value.images = []
        state.value.tags = []
        state.value.coauthors = []
        state.value.entries = []
        imageMetadata.value = {}
        draft.value = { id: null, status: 'new' }
        editingSetupId.value = null
        skipDraftSave.value = false
        publishIdempotencyKey.value = crypto.randomUUID()
        draftIdempotencyKey.value = crypto.randomUUID()
        void router.replace({ query: {} })
    }

    const saveDraft = useDebounceFn(async () => {
        if (skipDraftSave.value || publishing.value) {
            if (skipDraftSave.value) draft.value.status = 'restored'
            return
        }

        draft.value.status = 'saving'
        try {
            const items = state.value.entries
                .filter((item) => item?.id)
                .map((item) => ({
                    itemId: item.id,
                    category: item.category,
                    note: item.note || undefined,
                    unsupported: item.unsupported || false,
                    shapekeys: item.shapekeys?.length ? item.shapekeys : undefined,
                }))

            const content: SetupDraftContent = {
                public: state.value.public,
                name: state.value.name || undefined,
                description: state.value.description || undefined,
                images: state.value.images.length ? state.value.images : undefined,
                imageMetadata: getSelectedImageMetadata(),
                tags: state.value.tags.length
                    ? state.value.tags.map((tag) => ({ tag }))
                    : undefined,
                coauthors: state.value.coauthors.length
                    ? state.value.coauthors
                          .filter((c) => c.userId)
                          .map((c) => ({
                              userId: c.userId,
                              username: c.user.username,
                              note: c.note || undefined,
                          }))
                    : undefined,
                items: items.length ? items : undefined,
            }

            const response = await $fetch<{ draftId: string } | null>('/api/setups/drafts', {
                method: 'POST',
                headers: draft.value.id
                    ? undefined
                    : { 'Idempotency-Key': draftIdempotencyKey.value },
                body: {
                    id: draft.value.id ?? undefined,
                    setupId: editingSetupId.value ?? undefined,
                    content,
                },
            })

            if (response?.draftId) {
                if (!draft.value.id) draftIdempotencyKey.value = crypto.randomUUID()
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
            state.value.public !== true ||
            state.value.entries.length,
        ),
    )

    // Tags
    const addTag = (tag: string) => {
        if (!tag.trim()) return

        if (state.value.tags.includes(tag)) {
            toast.add({
                id: 'tag-duplicate',
                icon: 'mingcute:close-line',
                title: t('setup.compose.tagDuplicate'),
                color: 'warning',
            })
            return
        }

        state.value.tags.push(tag)
    }

    const removeTag = (tag: string) => {
        const index = state.value.tags.indexOf(tag)
        if (index !== -1) state.value.tags.splice(index, 1)
    }

    // Coauthors
    const addCoauthor = (user: Serialized<User>) => {
        if (!user?.username) return

        if (state.value.coauthors.some((c) => c.user.username === user.username)) {
            toast.add({
                id: 'coauthor-duplicate',
                icon: 'mingcute:close-line',
                title: t('setup.compose.coauthorDuplicate'),
                color: 'warning',
            })
            return
        }

        state.value.coauthors.push({
            userId: user.id,
            user: { ...user, name: user.name ?? '', image: user.image ?? '' },
            note: '',
        })
    }

    const removeCoauthor = (username: string) => {
        const index = state.value.coauthors.findIndex((c) => c.user.username === username)
        if (index !== -1) state.value.coauthors.splice(index, 1)
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
