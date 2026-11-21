import { useDebounceFn } from '@vueuse/core'
import { computed, onScopeDispose, ref, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue'

export const useCatalogItemSearch = (
    onSelect: (item: CatalogItemView) => boolean | void,
    options: {
        searchTerm?: Ref<string>
        endpoint?: MaybeRefOrGetter<string>
        selectedIds?: MaybeRefOrGetter<readonly string[]>
        atLimit?: MaybeRefOrGetter<boolean>
    } = {},
) => {
    const searchTerm = options.searchTerm ?? ref('')
    const results = ref<CatalogItemView[]>([])
    const pagination = ref<PaginationResponse<CatalogItemView[]>['pagination']>()
    const pending = ref(false)
    const failedPage = ref<number>()
    const composing = ref(false)
    const active = ref(false)
    const jobs = ref<
        {
            id: string
            url: string
            status: 'queued' | 'resolving' | 'failed' | 'added' | 'duplicate'
            error?: 'resolveFailed' | 'addFailed'
        }[]
    >([])
    const tooManyUrls = ref(false)
    const selectedIds = computed(() => toValue(options.selectedIds) ?? [])
    const atLimit = computed(() => toValue(options.atLimit) ?? false)
    const urls = computed(() =>
        [...new Set(searchTerm.value.match(/https?:\/\/[^\s<>"']+/giu) ?? [])].filter((url) => {
            try {
                return Boolean(new URL(url))
            } catch {
                return false
            }
        }),
    )
    let generation = 0
    let session = 0
    let fetching = false
    let request: AbortController | undefined
    const resolving = new Set<AbortController>()

    const fetchResults = async (page = 1) => {
        if (fetching || composing.value || !active.value) return
        const current = generation
        const controller = new AbortController()
        request = controller
        fetching = true
        pending.value = true
        failedPage.value = undefined
        try {
            const response = await $fetch<PaginationResponse<CatalogItemView[]>>(
                toValue(options.endpoint) ?? '/api/items',
                {
                    query: {
                        q: searchTerm.value.trim().slice(0, 100) || undefined,
                        page,
                        limit: 24,
                    },
                    signal: controller.signal,
                },
            )
            if (current !== generation) return
            const next = page === 1 ? response.data : [...results.value, ...response.data]
            results.value = [...new Map(next.map((item) => [item.id, item])).values()]
            pagination.value = response.pagination
        } catch (error) {
            if (current === generation && !controller.signal.aborted) {
                failedPage.value = page
                console.error('Failed to search items:', error)
            }
        } finally {
            if (current === generation) {
                pending.value = false
                fetching = false
            }
        }
    }
    const search = useDebounceFn(fetchResults, 300, { maxWait: 600 })
    const queueSearch = () => {
        generation += 1
        request?.abort()
        fetching = false
        results.value = []
        pagination.value = undefined
        failedPage.value = undefined
        pending.value = active.value
        if (active.value && !composing.value) void search()
    }
    watch([searchTerm, () => toValue(options.endpoint)], queueSearch, { flush: 'sync' })
    const activate = () => {
        if (active.value) return
        active.value = true
        queueSearch()
    }
    const selectItem = (item: CatalogItemView) => {
        if (selectedIds.value.includes(item.id)) return 'duplicate' as const
        if (atLimit.value || onSelect(item) === false) return 'failed' as const
        return 'added' as const
    }
    const runQueue = () => {
        while (resolving.size < 4) {
            const job = jobs.value.find(({ status }) => status === 'queued')
            if (!job) return
            const current = session
            const controller = new AbortController()
            resolving.add(controller)
            job.status = 'resolving'
            void $fetch<CatalogItemView>('/api/items/resolve', {
                method: 'POST',
                body: { reference: job.url },
                signal: controller.signal,
            })
                .then((item) => {
                    if (current !== session) return
                    job.status = selectItem(item)
                    if (job.status === 'failed') job.error = 'addFailed'
                })
                .catch((error: unknown) => {
                    if (current !== session || controller.signal.aborted) return
                    job.status = 'failed'
                    job.error = 'resolveFailed'
                    console.error('Failed to resolve item URL:', error)
                })
                .finally(() => {
                    resolving.delete(controller)
                    if (current === session) runQueue()
                })
        }
    }
    const resolveUrls = () => {
        const known = new Set(jobs.value.map(({ url }) => url))
        const next = urls.value.filter((url) => !known.has(url))
        tooManyUrls.value = next.length > 32
        if (tooManyUrls.value || atLimit.value) return
        jobs.value.push(
            ...next.map((url) => ({ id: crypto.randomUUID(), url, status: 'queued' as const })),
        )
        searchTerm.value = ''
        runQueue()
    }
    const retryJob = (id: string) => {
        const job = jobs.value.find((candidate) => candidate.id === id)
        if (!job || job.status !== 'failed' || atLimit.value) return
        job.status = 'queued'
        job.error = undefined
        runQueue()
    }
    const reset = () => {
        session += 1
        active.value = false
        composing.value = false
        searchTerm.value = ''
        queueSearch()
        for (const controller of resolving) controller.abort()
        resolving.clear()
        jobs.value = []
        tooManyUrls.value = false
    }
    onScopeDispose(reset)

    return {
        searchTerm,
        results,
        pagination,
        pending,
        failedPage,
        composing,
        jobs,
        urls,
        tooManyUrls,
        selectedIds,
        atLimit,
        activate,
        fetchResults,
        queueSearch,
        selectItem,
        resolveUrls,
        retryJob,
        reset,
    }
}

export type CatalogItemSearchSession = ReturnType<typeof useCatalogItemSearch>
