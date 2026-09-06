import {
    createDefaultSetupComposeForm,
    isEmptySetupComposeForm,
    setupDraftContentSchema,
    type SetupComposeForm,
    type SetupDraftContent,
} from '@avatio/core/setups'
import type { InjectionKey } from 'vue'

type ComposeUser = Pick<User, 'id' | 'username' | 'name' | 'image'>
type ComposeCoauthor = SetupComposeForm['coauthors'][number] & { user: ComposeUser }

const createSetupCompose = () => {
    const route = useRoute()
    const router = useRouter()
    const toast = useToast()
    const { t } = useI18n()
    const publishing = ref(false)
    const restoring = ref(false)
    const loadFailed = ref(false)
    const editingSetupId = ref<Setup['id'] | null>(null)
    const imageUploading = ref(false)
    const imageMetadata = ref<Record<string, SetupImageMetadata>>({})
    const itemEntities = ref<Record<string, Item>>({})
    const userEntities = ref<Record<string, ComposeUser>>({})
    const publishIdempotencyKey = ref(crypto.randomUUID())

    const updateRouterQuery = (updates: Record<string, string | undefined>) => {
        void router.replace({ query: { ...route.query, ...updates } })
    }
    const draftController = useSetupDraftController((id) =>
        updateRouterQuery({ draftId: id ?? undefined }),
    )
    const { form, values } = useSetupComposeForm((next) => {
        if (restoring.value || publishing.value) return
        loadFailed.value = false
        draftController.schedule(
            { ...next, imageMetadata: getSelectedImageMetadata() },
            editingSetupId.value,
        )
    })

    const setItems = (items: SetupComposeForm['items']) => form.setFieldValue('items', items)
    const {
        entries,
        totalItemsCount,
        addItem,
        updateItem,
        removeItem,
        changeItemCategory,
        addShapekey,
        removeShapekey,
        reorderCategory,
    } = useSetupComposeEntries(
        computed(() => values.value.items),
        setItems,
        itemEntities,
    )
    const { getSelectedImageMetadata, processImages, removeImage } = useSetupComposeImages(
        computed(() => values.value.images),
        (images) => form.setFieldValue('images', images),
        imageMetadata,
        imageUploading,
    )
    const coauthors = computed<ComposeCoauthor[]>(() =>
        values.value.coauthors.map((coauthor) => ({
            ...coauthor,
            user: userEntities.value[coauthor.userId] ?? {
                id: coauthor.userId,
                username: coauthor.username,
                name: coauthor.username,
                image: null,
            },
        })),
    )
    const draft = computed(() => ({
        id: draftController.state.id,
        status: loadFailed.value
            ? ('error' as const)
            : restoring.value
              ? ('restoring' as const)
              : draftController.state.status,
    }))
    const changed = computed(() => !isEmptySetupComposeForm(values.value))

    const resetFormOnce = async (content: SetupDraftContent) => {
        restoring.value = true
        imageMetadata.value = content.imageMetadata ?? {}
        const { imageMetadata: _, ...formValues } = content
        form.reset(formValues)
        await nextTick()
        restoring.value = false
    }

    const hydrateDraftReferences = async (content: SetupDraftContent) => {
        const [items, users] = await Promise.all([
            Promise.all(
                content.items.map(async ({ itemId }) => {
                    try {
                        return await $fetch<Item>(`/api/items/${itemId}`)
                    } catch (error) {
                        console.error('Failed to hydrate draft item:', itemId, error)
                        return null
                    }
                }),
            ),
            Promise.all(
                content.coauthors.map(async ({ userId, username }) => {
                    try {
                        return await $fetch<ComposeUser>(`/api/users/${username}`)
                    } catch (error) {
                        console.error('Failed to hydrate draft coauthor:', userId, error)
                        return null
                    }
                }),
            ),
        ])
        itemEntities.value = Object.fromEntries(
            items.flatMap((item) => (item ? [[item.id, item]] : [])),
        )
        userEntities.value = Object.fromEntries(
            users.flatMap((user) => (user ? [[user.id, user]] : [])),
        )
        await resetFormOnce(content)
    }

    const loadDraft = async (id: string) => {
        restoring.value = true
        loadFailed.value = false
        try {
            await draftController.flush()
            let draftData: SetupDraft | null = null
            try {
                draftData = await $fetch<SetupDraft>(`/api/setup-drafts/${id}`)
            } catch (error) {
                const local = await draftController.loadRecovery(id)
                if (local)
                    draftData = {
                        id: local.id,
                        revision: local.revision,
                        setupId: local.setupId,
                        content: setupDraftContentSchema.parse(local.content),
                        createdAt: new Date(local.updatedAt),
                        updatedAt: new Date(local.updatedAt),
                    }
                else if ((error as { statusCode?: number }).statusCode !== 404) throw error
            }
            if (!draftData) throw new Error('Draft not found')

            await hydrateDraftReferences(draftData.content)
            editingSetupId.value = draftData.setupId ?? null
            await draftController.switchSession(draftData.id, draftData.revision)
            updateRouterQuery({
                draftId: draftData.id,
                edit: draftData.setupId ?? undefined,
            })
        } catch (error) {
            loadFailed.value = true
            console.error('Failed to load draft:', error)
            toast.add({
                icon: 'mingcute:close-line',
                title: t('setup.compose.draftLoadFailed'),
                color: 'error',
            })
            updateRouterQuery({ draftId: undefined })
        } finally {
            restoring.value = false
        }
    }

    const loadSetup = async (setupId: Setup['id']) => {
        const setup = await $fetch<Setup>(`/api/me/setups/${setupId}`)
        const content: SetupDraftContent = {
            public: setup.public,
            name: setup.name,
            description: setup.description ?? '',
            images: setup.images?.map(({ url }) => url) ?? [],
            tags: setup.tags ?? [],
            coauthors:
                setup.coauthors?.map(({ user, note }) => ({
                    userId: user.id,
                    username: user.username,
                    note: note ?? '',
                })) ?? [],
            items: setup.items.map((item) => ({
                itemId: item.id,
                category: item.category,
                note: item.note ?? '',
                unsupported: item.unsupported ?? false,
                shapekeys: item.shapekeys ?? [],
            })),
            imageMetadata: Object.fromEntries(
                (setup.images ?? []).map((image) => [
                    image.url,
                    {
                        objectKey: image.objectKey,
                        contentType: image.contentType ?? undefined,
                        size: image.size ?? undefined,
                        etag: image.etag ?? undefined,
                        width: image.width,
                        height: image.height,
                        themeColors: image.themeColors ?? null,
                    },
                ]),
            ),
        }
        itemEntities.value = Object.fromEntries(setup.items.map((item) => [item.id, item]))
        userEntities.value = Object.fromEntries(
            (setup.coauthors ?? []).map(({ user }) => [user.id, user]),
        )
        await resetFormOnce(content)
        editingSetupId.value = setup.id
    }

    const initialize = async (args: { draftId?: string; edit?: Setup['id'] }) => {
        if (args.draftId) return loadDraft(args.draftId)
        if (!args.edit) return

        try {
            const drafts = await $fetch<SetupDraftSummary[]>('/api/setup-drafts', {
                query: { setupId: args.edit },
            })
            if (drafts[0]) {
                await loadDraft(drafts[0].id)
                toast.add({
                    icon: 'mingcute:back-line',
                    title: t('setup.compose.draftRestored'),
                    color: 'secondary',
                })
                return
            }
            await loadSetup(args.edit)
        } catch (error) {
            console.error('Failed to initialize setup editor:', error)
            toast.add({
                icon: 'mingcute:close-line',
                title: t('setup.compose.editModeFailed'),
                description: t('setup.compose.setupNotFound'),
                color: 'error',
            })
        }
    }

    const clearForm = async () => {
        restoring.value = true
        form.reset(createDefaultSetupComposeForm())
        imageMetadata.value = {}
        itemEntities.value = {}
        userEntities.value = {}
        editingSetupId.value = null
        publishIdempotencyKey.value = crypto.randomUUID()
        await nextTick()
        restoring.value = false
        void router.replace({ query: {} })
    }

    const publish = async (): Promise<Setup['id'] | undefined> => {
        if (publishing.value) return
        publishing.value = true
        try {
            await draftController.flush()
            const body = {
                public: values.value.public,
                name: values.value.name,
                description: values.value.description,
                items: values.value.items,
                images: values.value.images.length ? values.value.images : undefined,
                imageMetadata: getSelectedImageMetadata(),
                tags: values.value.tags.length
                    ? values.value.tags.map((tag) => ({ tag }))
                    : undefined,
                coauthors: values.value.coauthors.length
                    ? values.value.coauthors.map(({ userId, note }) => ({
                          userId,
                          note: note || undefined,
                      }))
                    : undefined,
            }
            if (!setupsInsertSchema.safeParse(body).success) throw new Error('Validation failed')

            const response = await $fetch<Setup>(
                editingSetupId.value ? `/api/setups/${editingSetupId.value}` : '/api/setups',
                {
                    method: editingSetupId.value ? 'PUT' : 'POST',
                    headers: editingSetupId.value
                        ? undefined
                        : { 'Idempotency-Key': publishIdempotencyKey.value },
                    body,
                },
            )
            await draftController.discard()
            await clearForm()
            return response.id
        } catch (error) {
            console.error('Failed to publish setup:', error)
            toast.add({
                icon: 'mingcute:close-line',
                title: editingSetupId.value
                    ? t('setup.compose.updateFailed')
                    : t('setup.compose.publishFailed'),
                color: 'error',
            })
        } finally {
            publishing.value = false
        }
    }

    const reset = async () => {
        await draftController.discard()
        await clearForm()
    }

    const addTag = (tag: string) => {
        if (!tag.trim()) return
        if (values.value.tags.includes(tag)) {
            toast.add({
                id: 'tag-duplicate',
                icon: 'mingcute:close-line',
                title: t('setup.compose.tagDuplicate'),
                color: 'warning',
            })
            return
        }
        form.setFieldValue('tags', [...values.value.tags, tag])
    }
    const removeTag = (tag: string) =>
        form.setFieldValue(
            'tags',
            values.value.tags.filter((candidate) => candidate !== tag),
        )

    const addCoauthor = (user: ComposeUser) => {
        if (!user?.username || values.value.coauthors.some(({ userId }) => userId === user.id))
            return
        userEntities.value = { ...userEntities.value, [user.id]: user }
        form.setFieldValue('coauthors', [
            ...values.value.coauthors,
            { userId: user.id, username: user.username, note: '' },
        ])
    }
    const removeCoauthor = (userId: string) =>
        form.setFieldValue(
            'coauthors',
            values.value.coauthors.filter((coauthor) => coauthor.userId !== userId),
        )
    const setCoauthors = (next: ComposeCoauthor[]) =>
        form.setFieldValue(
            'coauthors',
            next.map(({ userId, username, note }) => ({ userId, username, note })),
        )
    const updateCoauthorNote = (userId: string, note: string) =>
        form.setFieldValue(
            'coauthors',
            values.value.coauthors.map((coauthor) =>
                coauthor.userId === userId ? { ...coauthor, note } : coauthor,
            ),
        )

    const {
        data: drafts,
        status: draftsStatus,
        refresh: refreshDrafts,
    } = useFetch<SetupDraftSummary[]>('/api/setup-drafts', { default: () => [], dedupe: 'defer' })
    const deleteDrafts = async (ids: string[]) => {
        for (const id of ids) {
            await $fetch(`/api/setup-drafts/${id}`, { method: 'DELETE' })
            await deleteSetupDraftRecovery(id).catch(() => null)
        }
        if (ids.includes(draftController.state.id)) await reset()
        await refreshDrafts()
    }

    return {
        form,
        values,
        entries,
        coauthors,
        initialize,
        publish,
        reset,
        changed,
        editingSetupId,
        publishing,
        draft,
        loadDraft,
        addTag,
        removeTag,
        addCoauthor,
        removeCoauthor,
        setCoauthors,
        updateCoauthorNote,
        imageUploading,
        processImages,
        removeImage,
        totalItemsCount,
        addItem,
        updateItem,
        removeItem,
        changeItemCategory,
        addShapekey,
        removeShapekey,
        reorderCategory,
        drafts,
        draftsStatus,
        refreshDrafts,
        deleteDrafts,
    }
}

type SetupComposeContext = ReturnType<typeof createSetupCompose>
const setupComposeKey: InjectionKey<SetupComposeContext> = Symbol('setup-compose')

export const useSetupCompose = () => {
    const existing = inject(setupComposeKey, null)
    if (existing) return existing
    const created = createSetupCompose()
    provide(setupComposeKey, created)
    return created
}
