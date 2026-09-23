import type { FetchResult } from 'nuxt/app'

type SetupResponse = FetchResult<'/api/setups/:id', 'get'>

export const useSetup = (id: MaybeRefOrGetter<Setup['id']>) =>
    useFetch<SetupResponse>(
        computed(() => `/api/setups/${toValue(id)}` as '/api/setups/:id'),
        {
            key: computed(() => `setup-${toValue(id)}`),
            dedupe: 'defer',
        },
    )

export const useViewerSetup = (id: MaybeRefOrGetter<Setup['id']>) =>
    useFetch<SetupResponse>(
        computed(() => `/api/me/setups/${toValue(id)}`),
        {
            key: computed(() => `viewer-setup-${toValue(id)}`),
            dedupe: 'defer',
            headers: useRequestHeaders(['cookie']),
        },
    )

export const useSetupsList = (
    type?: 'latest' | 'owned' | 'bookmarked',
    options?: {
        username?: MaybeRefOrGetter<User['username'] | undefined>
        query?: MaybeRef<Record<string, unknown>>
        immediate?: boolean
        watch?: false
        onAppend?: (ids: string[]) => void
    },
) => {
    type ListResponse = NonNullable<FetchResult<'/api/setups', 'get'>>
    type ListItem = ListResponse['data'][number]

    const { user } = useUserSession()
    const baseQuery = computed(() => {
        const query: Record<string, unknown> = { ...(unref(options?.query) || {}) }
        if (type) {
            if (!query.limit) {
                query.limit =
                    type === 'latest'
                        ? LATEST_SETUPS_LIST_PER_PAGE
                        : type === 'owned'
                          ? USER_SETUPS_LIST_PER_PAGE
                          : BOOKMARKS_LIST_PER_PAGE
            }
            const username = options?.username ? toValue(options.username) : undefined
            if (type === 'owned' && username) query.username = username
            if (type === 'bookmarked') query.bookmarked = true
        }
        return query
    })
    const cacheKey = computed(
        () =>
            `setups-${type || 'custom'}-${type === 'latest' || !type ? '' : user.value?.id || 'anonymous'}-${JSON.stringify(baseQuery.value)}`,
    )
    const firstPageQuery = computed(() => ({ ...baseQuery.value, page: 1 }))
    const appended = shallowRef<ListItem[]>([])
    const appendedPagination = shallowRef<ListResponse['pagination']>()
    const loadingMore = ref(false)
    let generation = 0

    const {
        data: firstPage,
        status: firstPageStatus,
        refresh: refreshFirstPage,
        clear: clearFirstPage,
    } = useFetch('/api/setups', {
        key: cacheKey,
        query: firstPageQuery,
        dedupe: 'cancel',
        immediate: options?.immediate !== false,
        watch: options?.watch === false ? false : [cacheKey],
    })
    const setups = computed(() => {
        const seen = new Set<string>()
        return [...(firstPage.value?.data ?? []), ...appended.value].filter((setup) => {
            if (seen.has(setup.id)) return false
            seen.add(setup.id)
            return true
        })
    })
    const pagination = computed(() => appendedPagination.value ?? firstPage.value?.pagination)
    const status = computed(() => (loadingMore.value ? 'pending' : firstPageStatus.value))

    const resetAppended = () => {
        generation += 1
        appended.value = []
        appendedPagination.value = undefined
        loadingMore.value = false
    }

    if (options?.watch !== false) watch(cacheKey, resetAppended, { flush: 'sync' })

    const loadMore = async () => {
        if (loadingMore.value || firstPageStatus.value === 'pending' || !pagination.value?.hasNext)
            return

        loadingMore.value = true
        const requestGeneration = generation
        const query = { ...baseQuery.value, page: pagination.value.page + 1 }
        try {
            const response = await $fetch<ListResponse>('/api/setups', { query })
            if (generation !== requestGeneration) return

            const existing = new Set(setups.value.map((setup) => setup.id))
            const additions = response.data.filter((setup) => !existing.has(setup.id))
            appended.value = [...appended.value, ...additions]
            appendedPagination.value = response.pagination
            options?.onAppend?.(additions.map((setup) => setup.id))
        } catch (error) {
            console.error('Failed to load more setups:', error)
        } finally {
            if (generation === requestGeneration) loadingMore.value = false
        }
    }

    const refresh = async () => {
        resetAppended()
        await refreshFirstPage()
    }

    const clear = () => {
        resetAppended()
        clearFirstPage()
    }

    return {
        setups,
        status,
        pagination,
        loadMore,
        refresh,
        clear,
    }
}

export const useDeleteSetup = (setupId: Setup['id']) => {
    const { t } = useI18n()
    const toast = useToast()

    const deleteSetup = async () => {
        await $fetch(`/api/setups/${setupId}` as '/api/setups/:id', {
            method: 'DELETE',
            onResponseError({ error }) {
                toast.add({
                    title: t('toast.admin.setupDeleteFailed'),
                    description:
                        error instanceof Error ? error.message : t('toast.reports.unknownError'),
                    color: 'error',
                })
            },
        })
        toast.add({
            title: t('toast.admin.setupDeleted'),
            description: t('toast.admin.setupDeleteDescription'),
            color: 'success',
        })
    }

    return {
        deleteSetup,
    }
}
