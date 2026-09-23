import {
    createDefaultSetupComposeForm,
    isEmptySetupComposeForm,
    setupDraftContentSchema,
    type SetupComposeForm,
    type SetupDraftContent,
} from '@avatio/core/setups'

type ComposeUser = Pick<User, 'id' | 'username' | 'name' | 'image'>
type ComposeCoauthor = SetupComposeForm['coauthors'][number] & { user: ComposeUser }

const createSetupCompose = () => {
    const route = useRoute()
    const router = useRouter()
    const toast = useToast()
    const { t } = useI18n()
    const { user } = useUserSession()
    const { switchAccount: switchDeviceAccount } = useDeviceSessions()
    const requestFetch = useRequestFetch()
    const publishing = ref(false)
    const switchingAccount = ref(false)
    const restoring = ref(false)
    const loadFailed = ref(false)
    const editingSetupId = ref<Setup['id'] | null>(null)
    const imageMetadata = shallowRef<Record<string, SetupImageMetadata>>({})
    const itemEntities = ref<Record<string, CatalogItemView>>({})
    const userEntities = ref<Record<string, ComposeUser>>({})
    const itemSearchTerm = ref('')
    const itemScrollTop = ref(0)
    const publishIdempotencyKey = ref(crypto.randomUUID())

    const updateRouterQuery = (updates: Record<string, string | undefined>) => {
        void router.replace({ query: { ...route.query, ...updates } })
    }
    const draftController = useSetupDraftController((id) =>
        updateRouterQuery({ draftId: id ?? undefined }),
    )
    const { form, values } = useSetupComposeForm((next) => {
        if (restoring.value || publishing.value || switchingAccount.value) return
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
        removeItem: removeEntry,
        changeItemCategory,
        addShapekey,
        removeShapekey,
        reorderCategory,
    } = useSetupComposeEntries(
        computed(() => values.value.items),
        setItems,
        itemEntities,
    )
    const {
        getImageId,
        getSelectedImageMetadata,
        uploads,
        imageUploading,
        processImages,
        cancelUpload,
        cancelAllUploads,
        retryUpload,
        removeImage: removeSelectedImage,
        reorderImages,
    } = useSetupComposeImages(
        computed(() => values.value.images),
        (images) => form.setFieldValue('images', images),
        imageMetadata,
    )
    const removeItem = (category: ItemCategory, entryId: string) => {
        removeEntry(category, entryId)
        form.setFieldValue(
            'points',
            values.value.points.filter((point) => point.entryId !== entryId),
        )
    }
    const removeImage = (index: number) => {
        const url = values.value.images[index]
        if (url)
            form.setFieldValue(
                'points',
                values.value.points.filter((point) => point.imageId !== getImageId(url)),
            )
        removeSelectedImage(index)
    }
    const pointEditor = useSetupImagePointsModal()
    const openImagePoints = (url: string, placingEntryId?: string) => {
        const imageId = getImageId(url)
        void pointEditor.open({
            imageUrl: url,
            imageId,
            placingEntryId,
            entries: entries.value.map(({ id, name, image }) => ({ id, name, image })),
            points: values.value.points.filter((point) => point.imageId === imageId),
            onUpdate: (points: SetupPoint[]) =>
                form.setFieldValue('points', [
                    ...values.value.points.filter((point) => point.imageId !== imageId),
                    ...points,
                ]),
        })
    }
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
        imageMetadata.value = Object.fromEntries(
            content.images.map((url) => [
                url,
                {
                    ...content.imageMetadata?.[url],
                    id: content.imageMetadata?.[url]?.id ?? crypto.randomUUID(),
                },
            ]),
        ) as Record<string, SetupImageMetadata>
        const { imageMetadata: _, ...formValues } = content
        form.reset({
            ...formValues,
            items: formValues.items.map((entry) => ({
                ...entry,
                id: entry.id ?? crypto.randomUUID(),
            })),
            points: formValues.points ?? [],
        })
        await nextTick()
        restoring.value = false
    }

    const hydrateDraftReferences = async (content: SetupDraftContent) => {
        const [items, users] = await Promise.all([
            Promise.all(
                content.items.map(async ({ itemId }) => {
                    try {
                        return await requestFetch<CatalogItemView>('/api/items/resolve', {
                            method: 'POST',
                            body: { reference: itemId },
                        })
                    } catch (error) {
                        console.error('Failed to hydrate draft item:', itemId, error)
                        return null
                    }
                }),
            ),
            Promise.all(
                content.coauthors.map(async ({ userId, username }) => {
                    try {
                        return await requestFetch<ComposeUser>(`/api/users/${username}`)
                    } catch (error) {
                        console.error('Failed to hydrate draft coauthor:', userId, error)
                        return null
                    }
                }),
            ),
        ])
        draftController.requireOwner()
        itemEntities.value = Object.fromEntries(
            items.flatMap((item) => (item ? [[item.id, item]] : [])),
        )
        userEntities.value = Object.fromEntries(
            users.flatMap((user) => (user ? [[user.id, user]] : [])),
        )
        await resetFormOnce({
            ...content,
            items: content.items.map((entry, index) => ({
                ...entry,
                itemId: items[index]?.id ?? entry.itemId,
            })),
        })
    }

    const loadDraft = async (id: string) => {
        restoring.value = true
        loadFailed.value = false
        cancelAllUploads()
        try {
            await draftController.flush()
            const draftData = await draftController.load(id)

            await hydrateDraftReferences(draftData.content)
            editingSetupId.value = draftData.setupId ?? null
            await draftController.switchSession(draftData.id, draftData.revision)
            if (draftData.recoveredLocally)
                draftController.schedule(
                    setupDraftContentSchema.parse({
                        ...values.value,
                        imageMetadata: getSelectedImageMetadata(),
                    }),
                    editingSetupId.value,
                )
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
        const setup = await requestFetch<Setup>(`/api/me/setups/${setupId}`)
        draftController.requireOwner()
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
            items: setup.entries.map((item) => ({
                id: item.id,
                itemId: item.catalogItem.id,
                category: item.category,
                note: item.note ?? '',
                unsupported: item.unsupported ?? false,
                shapekeys: item.shapekeys ?? [],
            })),
            points: setup.points ?? [],
            imageMetadata: Object.fromEntries(
                (setup.images ?? []).map((image) => [
                    image.url,
                    {
                        id: image.id,
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
        itemEntities.value = Object.fromEntries(
            setup.entries.map(({ catalogItem }) => [catalogItem.id, catalogItem]),
        )
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
            const drafts = await requestFetch<SetupDraftSummary[]>('/api/setup-drafts', {
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
        cancelAllUploads()
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
        if (publishing.value || imageUploading.value) return
        publishing.value = true
        try {
            await draftController.flush()
            draftController.requireOwner()
            const body = {
                public: values.value.public,
                name: values.value.name,
                description: values.value.description,
                items: values.value.items,
                images: values.value.images,
                imageMetadata: getSelectedImageMetadata(),
                points: values.value.points,
                tags: values.value.tags.map((tag) => ({ tag })),
                coauthors: values.value.coauthors.map(({ userId, note }) => ({
                    userId,
                    note: note || undefined,
                })),
            }
            if (!setupsInsertSchema.safeParse(body).success) throw new Error('Validation failed')

            const response = await requestFetch<Setup>(
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

    const switchPostingAccount = async (target: DeviceSession) => {
        if (
            switchingAccount.value ||
            publishing.value ||
            imageUploading.value ||
            editingSetupId.value ||
            target.user.id === user.value?.id
        )
            return

        switchingAccount.value = true
        try {
            if (!changed.value) {
                await switchDeviceAccount(target)
                return
            }

            draftController.schedule(
                setupDraftContentSchema.parse({
                    ...values.value,
                    imageMetadata: getSelectedImageMetadata(),
                }),
                null,
            )
            await draftController.flush()
            if (!['saved', 'restored'].includes(draftController.state.status))
                throw new Error('Draft must be saved before switching accounts.')

            await requestFetch(`/api/setup-drafts/${draftController.state.id}/transfer`, {
                method: 'POST',
                body: {
                    targetSessionToken: target.session.token,
                    expectedRevision: draftController.state.revision,
                },
            })
            await draftController.deleteRecovery(draftController.state.id).catch(() => null)
            reloadNuxtApp({ force: true })
        } catch {
            switchingAccount.value = false
            console.error('Failed to switch setup posting account.')
            toast.add({
                icon: 'mingcute:close-line',
                title: t('setup.compose.switchAccountFailed'),
                color: 'error',
            })
        }
    }

    const reset = async () => {
        await draftController.discard()
        await clearForm()
    }

    const addTag = (tag: string) => {
        const normalized = tag.trim().slice(0, 32)
        if (!normalized || values.value.tags.length >= 8) return
        if (values.value.tags.includes(normalized)) {
            toast.add({
                id: 'tag-duplicate',
                icon: 'mingcute:close-line',
                title: t('setup.compose.tagDuplicate'),
                color: 'warning',
            })
            return
        }
        form.setFieldValue('tags', [...values.value.tags, normalized])
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
            await requestFetch(`/api/setup-drafts/${id}`, { method: 'DELETE' })
            await draftController.deleteRecovery(id).catch(() => null)
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
        switchingAccount: readonly(switchingAccount),
        switchPostingAccount,
        draft,
        loadDraft,
        addTag,
        removeTag,
        addCoauthor,
        removeCoauthor,
        setCoauthors,
        updateCoauthorNote,
        imageUploading,
        uploads,
        processImages,
        cancelUpload,
        retryUpload,
        removeImage,
        reorderImages,
        getImageId,
        openImagePoints,
        totalItemsCount,
        addItem,
        updateItem,
        removeItem,
        changeItemCategory,
        addShapekey,
        removeShapekey,
        reorderCategory,
        itemSearchTerm,
        itemScrollTop,
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
