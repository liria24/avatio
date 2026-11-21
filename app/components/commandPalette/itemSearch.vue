<script setup lang="ts">
import type { CatalogItemSearchSession } from '~/composables/catalogItemSearch'

const emit = defineEmits<{ select: [item: CatalogItemView] }>()
const props = withDefaults(
    defineProps<{
        loading?: boolean
        allowResolve?: boolean
        endpoint?: string
        session?: CatalogItemSearchSession
    }>(),
    { allowResolve: true, endpoint: '/api/items' },
)
const searchTerm = defineModel<string>('searchTerm', { default: '' })
const session =
    props.session ??
    useCatalogItemSearch((item) => emit('select', item), {
        searchTerm,
        endpoint: () => props.endpoint,
    })
const { results, pending, failedPage, composing, jobs, urls, tooManyUrls, selectedIds, atLimit } =
    session
const inputTerm = session.searchTerm
const open = ref(false)
const menu = ref<{ inputRef?: HTMLInputElement; viewportRef?: HTMLElement }>()
const { t } = useI18n()
const focusInput = () => nextTick(() => menu.value?.inputRef?.focus())
const finishSelection = () => {
    open.value = false
    if (props.session) void focusInput()
}
const selectItem = (item: CatalogItemView) => {
    if (composing.value || session.selectItem(item) !== 'added') return
    inputTerm.value = ''
    finishSelection()
}
const rows = computed(() => [
    ...(props.allowResolve && urls.value.some((url) => !jobs.value.some((job) => job.url === url))
        ? [
              {
                  id: 'resolve-urls',
                  label: t('commandPalette.itemSearch.addUrls', { count: urls.value.length }),
                  icon: 'mingcute:link-fill',
                  disabled: atLimit.value,
                  item: undefined,
                  onSelect: (event: Event) => {
                      event.preventDefault()
                      if (!composing.value) {
                          session.resolveUrls()
                          finishSelection()
                      }
                  },
              },
          ]
        : []),
    ...results.value.map((item) => ({
        id: item.id,
        label: item.name,
        description: item.primarySource?.publisher?.name,
        disabled: selectedIds.value.includes(item.id) || atLimit.value,
        item,
        onSelect: (event: Event) => {
            event.preventDefault()
            selectItem(item)
        },
    })),
])
watch(open, (value) => {
    if (value) session.activate()
})
useInfiniteScroll(
    computed(() => menu.value?.viewportRef),
    () => session.fetchResults((session.pagination.value?.page ?? 0) + 1),
    {
        distance: 120,
        canLoadMore: () =>
            open.value &&
            !pending.value &&
            !failedPage.value &&
            !!session.pagination.value?.hasNext,
    },
)
const onKeydown = (event: KeyboardEvent) => {
    if (event.key !== 'Enter') return
    // Reka handles the selected option before this bubbles; keep Enter out of the parent form.
    event.preventDefault()
    if (event.isComposing || composing.value) event.stopPropagation()
}
const onComposition = (value: boolean) => {
    composing.value = value
    session.queueSearch()
}
</script>

<template>
    <div class="flex min-w-0 flex-col gap-2" @keydown="onKeydown">
        <UInputMenu
            ref="menu"
            v-model="inputTerm"
            v-model:open="open"
            mode="autocomplete"
            :items="rows"
            value-key="id"
            ignore-filter
            :reset-search-term-on-blur="false"
            :reset-search-term-on-select="false"
            open-on-click
            :virtualize="{ estimateSize: 56, overscan: 8 }"
            :loading="props.loading || pending"
            icon="mingcute:package-2-fill"
            :placeholder="$t('commandPalette.itemSearch.placeholder')"
            :aria-label="$t('commandPalette.itemSearch.placeholder')"
            variant="soft"
            size="lg"
            autocomplete="off"
            class="w-full"
            :ui="{
                content: 'max-w-[calc(100vw-2rem)]',
                viewport: 'max-h-72',
                item: 'min-h-14',
                itemLabel: 'text-toned',
                itemDescription: 'text-toned',
                empty: 'text-toned',
            }"
            @compositionstart="onComposition(true)"
            @compositionend="onComposition(false)"
        >
            <template #item-leading="{ item: row }">
                <UAvatar
                    v-if="row.item"
                    :src="row.item.image || undefined"
                    :alt="row.item.name"
                    icon="mingcute:package-2-fill"
                    size="lg"
                    class="rounded-md"
                />
                <Icon v-else name="mingcute:link-fill" size="20" />
            </template>
            <template #item-trailing="{ item: row }">
                <span v-if="selectedIds.includes(row.id)" class="text-toned text-xs">
                    {{ $t('commandPalette.itemSearch.alreadyAdded') }}
                </span>
            </template>
            <template #empty>
                <span role="option" aria-disabled="true">
                    {{
                        pending
                            ? $t('commandPalette.itemSearch.searching')
                            : failedPage
                              ? $t('commandPalette.itemSearch.searchFailed')
                              : $t('commandPalette.itemSearch.noResults')
                    }}
                </span>
            </template>
            <template v-if="failedPage" #content-bottom>
                <UButton
                    :label="$t('content.retry')"
                    icon="mingcute:refresh-2-fill"
                    variant="soft"
                    color="error"
                    block
                    class="m-2 w-[calc(100%-1rem)]"
                    @click="session.fetchResults(failedPage)"
                />
            </template>
        </UInputMenu>
        <UAlert
            v-if="atLimit || tooManyUrls"
            color="warning"
            variant="soft"
            :title="$t('commandPalette.itemSearch.' + (atLimit ? 'itemLimit' : 'urlLimit'))"
        />
        <div
            v-if="jobs.length"
            class="flex max-h-40 flex-col gap-1 overflow-y-auto"
            aria-live="polite"
        >
            <div v-for="job in jobs" :key="job.id" class="flex min-w-0 items-center gap-2 text-xs">
                <Icon
                    :name="
                        job.status === 'resolving'
                            ? 'svg-spinners:ring-resize'
                            : job.status === 'queued'
                              ? 'mingcute:time-fill'
                              : job.status === 'failed'
                                ? 'mingcute:warning-fill'
                                : 'mingcute:check-fill'
                    "
                    size="16"
                    class="shrink-0"
                />
                <span class="text-toned min-w-0 grow truncate" :title="job.url">{{ job.url }}</span>
                <span class="text-toned shrink-0">{{
                    $t('commandPalette.itemSearch.' + (job.error ?? job.status))
                }}</span>
                <UButton
                    v-if="job.status === 'failed'"
                    :label="$t('content.retry')"
                    variant="ghost"
                    size="xs"
                    :disabled="atLimit"
                    @click="session.retryJob(job.id)"
                />
            </div>
        </div>
    </div>
</template>
