<script setup lang="ts">
const emit = defineEmits<{
    select: [item: CatalogItemView]
}>()

const props = withDefaults(
    defineProps<{ loading?: boolean; allowResolve?: boolean; endpoint?: string }>(),
    { allowResolve: true, endpoint: '/api/items' },
)
const searchTerm = defineModel<string>('searchTerm', { default: '' })

type UrlJob = {
    id: string
    url: string
    status: 'resolving' | 'failed' | 'added'
}

type SearchRow =
    | { id: string; type: 'resolve'; urls: string[] }
    | { id: string; type: 'url'; job: UrlJob }
    | { id: string; type: 'item'; item: CatalogItemView }
    | { id: string; type: 'error'; page: number }
    | { id: string; type: 'empty' }

const results = ref<CatalogItemView[]>([])
const pagination = ref<PaginationResponse<CatalogItemView[]>['pagination']>()
const urlJobs = ref<UrlJob[]>([])
const searchPending = ref(false)
const failedPage = ref<number>()
const composing = ref(false)
const scrollArea = ref<{ $el?: HTMLElement }>()
const root = ref<HTMLElement>()
const open = ref(false)
let generation = 0
let request: AbortController | undefined

const extractUrls = (text: string) =>
    [...new Set(text.match(/https?:\/\/[^\s<>"']+/giu) ?? [])].filter((value) => {
        try {
            return Boolean(new URL(value))
        } catch {
            return false
        }
    })

const fetchResults = async (page = 1) => {
    if (searchPending.value) return
    const current = generation
    const query = searchTerm.value.trim().slice(0, 100)
    request = new AbortController()
    searchPending.value = true
    failedPage.value = undefined
    if (page === 1) {
        results.value = []
        pagination.value = undefined
    }
    try {
        const response = await $fetch<PaginationResponse<CatalogItemView[]>>(props.endpoint, {
            query: { q: query || undefined, page, limit: 24 },
            signal: request.signal,
        })
        if (current !== generation) return
        results.value = page === 1 ? response.data : [...results.value, ...response.data]
        pagination.value = response.pagination
    } catch (error) {
        if (current === generation && (error as { name?: string }).name !== 'AbortError') {
            failedPage.value = page
            console.error('Failed to search items:', error)
        }
    } finally {
        if (current === generation) {
            searchPending.value = false
            await nextTick()
            void loadIfNearEnd()
        }
    }
}

const search = useDebounceFn(() => fetchResults(), 300, { maxWait: 600 })
const queueSearch = () => {
    generation += 1
    request?.abort()
    searchPending.value = false
    if (!composing.value) void search()
}
watch(searchTerm, queueSearch, { immediate: true })
onBeforeUnmount(() => request?.abort())

const resolveJob = async (job: UrlJob) => {
    job.status = 'resolving'
    try {
        const item = await $fetch<CatalogItemView>('/api/items/resolve', {
            method: 'POST',
            body: { reference: job.url },
        })
        emit('select', item)
        job.status = 'added'
    } catch (error) {
        job.status = 'failed'
        console.error('Failed to resolve item URL:', error)
    }
}

const resolveUrls = (urls: string[]) => {
    open.value = true
    const known = new Set(urlJobs.value.map(({ url }) => url))
    const jobs = urls
        .filter((url) => !known.has(url))
        .slice(0, 32)
        .map((url): UrlJob => ({ id: crypto.randomUUID(), url, status: 'resolving' }))
    urlJobs.value.push(...jobs)
    for (const job of jobs) void resolveJob(job)
}

const onPaste = (event: ClipboardEvent) => {
    if (!props.allowResolve) return
    const text = event.clipboardData?.getData('text') ?? ''
    const urls = extractUrls(text)
    if (urls.length) resolveUrls(urls)
}

onClickOutside(root, () => (open.value = false))

const rows = computed<SearchRow[]>(() => {
    const typedUrls = props.allowResolve ? extractUrls(searchTerm.value) : []
    const canResolve = typedUrls.filter(
        (url) => !urlJobs.value.some((candidate) => candidate.url === url),
    )
    return [
        ...(canResolve.length
            ? [{ id: 'resolve-urls', type: 'resolve' as const, urls: canResolve }]
            : []),
        ...urlJobs.value.map((job) => ({ id: job.id, type: 'url' as const, job })),
        ...results.value.map((item) => ({ id: item.id, type: 'item' as const, item })),
        ...(failedPage.value
            ? [{ id: 'search-error', type: 'error' as const, page: failedPage.value }]
            : []),
        ...(!searchPending.value && !failedPage.value && !results.value.length
            ? [{ id: 'empty', type: 'empty' as const }]
            : []),
    ]
})

async function loadIfNearEnd() {
    const element = scrollArea.value?.$el
    if (
        !element ||
        searchPending.value ||
        failedPage.value ||
        !pagination.value?.hasNext ||
        element.scrollTop + element.clientHeight < element.scrollHeight - 120
    )
        return
    await fetchResults(pagination.value.page + 1)
}

const onCompositionEnd = () => {
    composing.value = false
    queueSearch()
}

const selectItem = (item: CatalogItemView) => {
    emit('select', item)
    searchTerm.value = ''
    open.value = false
}
</script>

<template>
    <div ref="root" class="relative min-w-72 md:min-w-96">
        <UInput
            v-model="searchTerm"
            icon="mingcute:package-2-fill"
            :placeholder="$t('commandPalette.itemSearch.placeholder')"
            :aria-label="$t('commandPalette.itemSearch.placeholder')"
            variant="soft"
            size="lg"
            autocomplete="off"
            class="w-full"
            @focus="open = true"
            @compositionstart="composing = true"
            @compositionend="onCompositionEnd"
            @paste="onPaste"
            @keydown.escape="open = false"
        >
            <template v-if="props.loading || searchPending" #trailing>
                <Icon name="svg-spinners:ring-resize" size="16" class="text-muted" />
            </template>
        </UInput>

        <div
            v-if="open"
            class="bg-default ring-muted absolute inset-x-0 top-[calc(100%+0.375rem)] z-20 overflow-hidden rounded-lg shadow-xl ring-1"
        >
            <UScrollArea
                ref="scrollArea"
                :items="rows"
                :virtualize="{ estimateSize: 56, overscan: 8, skipMeasurement: true }"
                shadow
                class="h-72"
                :ui="{ item: 'px-2 py-1' }"
                @scroll="loadIfNearEnd"
            >
                <template #default="{ item: row }">
                    <UButton
                        v-if="row.type === 'resolve'"
                        :label="$t('commandPalette.itemSearch.addUrls', { count: row.urls.length })"
                        icon="mingcute:link-fill"
                        variant="soft"
                        block
                        class="h-12 justify-start"
                        @click="resolveUrls(row.urls)"
                    />

                    <div
                        v-else-if="row.type === 'url'"
                        class="ring-muted flex h-12 min-w-0 items-center gap-2 rounded-lg px-3 ring-1"
                    >
                        <Icon
                            :name="
                                row.job.status === 'resolving'
                                    ? 'svg-spinners:ring-resize'
                                    : row.job.status === 'added'
                                      ? 'mingcute:check-fill'
                                      : 'mingcute:warning-fill'
                            "
                            size="18"
                            :class="row.job.status === 'failed' ? 'text-error' : 'text-muted'"
                        />
                        <span class="grow truncate text-xs">{{ row.job.url }}</span>
                        <UButton
                            v-if="row.job.status === 'failed'"
                            :label="$t('retry')"
                            variant="ghost"
                            size="xs"
                            @click="resolveJob(row.job)"
                        />
                    </div>

                    <button
                        v-else-if="row.type === 'item'"
                        type="button"
                        class="hover:bg-elevated flex h-12 w-full items-center gap-3 rounded-lg px-2 text-left transition-colors"
                        @click="selectItem(row.item)"
                    >
                        <NuxtImg
                            v-if="row.item.image"
                            :src="row.item.image"
                            :alt="row.item.name"
                            width="40"
                            height="40"
                            class="size-10 shrink-0 rounded-md object-cover"
                        />
                        <span
                            v-else
                            class="bg-muted grid size-10 shrink-0 place-items-center rounded-md"
                        >
                            <Icon name="mingcute:package-2-fill" size="18" class="text-muted" />
                        </span>
                        <span class="min-w-0 grow">
                            <span class="text-toned block truncate text-sm">{{
                                row.item.name
                            }}</span>
                            <span class="text-muted block truncate text-xs">
                                {{ row.item.primarySource?.publisher?.name }}
                            </span>
                        </span>
                    </button>

                    <UButton
                        v-else-if="row.type === 'error'"
                        :label="$t('retry')"
                        icon="mingcute:refresh-2-fill"
                        color="error"
                        variant="soft"
                        block
                        class="h-12"
                        @click="fetchResults(row.page)"
                    />

                    <p v-else class="text-muted grid h-12 place-items-center text-sm">
                        {{ $t('commandPalette.itemSearch.noResults') }}
                    </p>
                </template>
            </UScrollArea>
        </div>
    </div>
</template>
