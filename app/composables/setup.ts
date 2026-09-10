import type { UseFetchOptions, FetchResult } from 'nuxt/app'

import type { KeysOf } from '#app/composables/asyncData'

type SetupRes = FetchResult<'/api/setups/:id', 'get'>

export const useSetup = <
    DataT = SetupRes,
    PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
    DefaultT = undefined,
>(
    id: Setup['id'],
    options?: UseFetchOptions<SetupRes, DataT, PickKeys, DefaultT, '/api/setups/:id', 'get'>,
) =>
    useFetch(`/api/setups/${id}` as '/api/setups/:id', {
        key: computed(() => `setup-${id}-${JSON.stringify(unref(options?.query))}`),
        dedupe: 'defer',
        lazy: false,
        immediate: true,
        ...options,
    })

export const useViewerSetup = (id: Setup['id']) =>
    useFetch<SetupRes>(`/api/me/setups/${id}`, {
        key: computed(() => `viewer-setup-${id}`),
        dedupe: 'defer',
        lazy: false,
        immediate: true,
        headers: useRequestHeaders(['cookie']),
    })

export const useSetupsList = (
    type?: 'latest' | 'owned' | 'bookmarked',
    options?: {
        username?: User['username']
        query?: MaybeRef<Record<string, unknown>>
        immediate?: boolean
        watch?: UseFetchOptions<unknown>['watch']
    },
) => {
    const page = ref(1)
    const cacheKey = computed(
        () =>
            `setups-state-${type || 'custom'}-${options?.username || ''}-${JSON.stringify(unref(options?.query) || {})}`,
    )
    const setups = useState<NonNullable<FetchResult<'/api/setups', 'get'>>['data']>(
        cacheKey.value,
        () => [],
    )
    const pagination = useState<
        NonNullable<FetchResult<'/api/setups', 'get'>>['pagination'] | undefined
    >(`${cacheKey.value}-pagination`, () => undefined)

    // Build query parameters
    const queryParams = computed(() => {
        const base: Record<string, unknown> = {
            page: page.value,
            ...(unref(options?.query) || {}),
        }

        // typeが指定されている場合のみ、デフォルトのlimitを設定
        if (type) {
            // limitが明示的に指定されていない場合のみデフォルト値を使用
            if (!base.limit) {
                base.limit =
                    type === 'latest'
                        ? LATEST_SETUPS_LIST_PER_PAGE
                        : type === 'owned'
                          ? USER_SETUPS_LIST_PER_PAGE
                          : BOOKMARKS_LIST_PER_PAGE
            }

            // Add username for owned type
            if (type === 'owned' && options?.username) base.username = options.username

            // Add bookmarked flag for bookmarked type
            if (type === 'bookmarked') base.bookmarked = true
        }

        return base
    })

    // Fetch data - 常に /api/setups を使用
    const { status, refresh } = useFetch('/api/setups', {
        key: computed(
            () => `setups-fetch-${type || 'custom'}-${JSON.stringify(queryParams.value)}`,
        ),
        query: queryParams,
        dedupe: 'defer',
        lazy: false,
        immediate: options?.immediate !== false,
        ...(options?.watch !== undefined ? { watch: options.watch } : {}),
        onResponse({ response }) {
            if (response._data?.data) {
                pagination.value = response._data.pagination
                if (page.value === 1) setups.value = response._data.data
                else setups.value = [...setups.value, ...response._data.data]
            }
        },
    })

    // Initialize: Load initial data
    const initialize = async () => {
        page.value = 1
        await refresh()
    }

    // Load more: Append next page data
    const loadMore = async () => {
        if (status.value !== 'pending' && pagination.value?.hasNext) {
            page.value = pagination.value.page + 1
            await refresh()
        }
    }

    // Refresh: Reset to first page
    const refreshData = async () => {
        page.value = 1
        await refresh()
    }

    return {
        setups,
        status,
        pagination,
        initialize,
        loadMore,
        refresh: refreshData,
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
