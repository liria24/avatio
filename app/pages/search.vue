<script lang="ts" setup>
const { t } = useI18n()

const toArray = (val: string | string[] | null): string[] => {
    if (Array.isArray(val)) return val
    return val ? [String(val)] : []
}

const q = useRouteQuery('q', '')
const itemIds = useRouteQuery<Item['id'][]>('itemId', [], { transform: toArray })
const tags = useRouteQuery<string[]>('tag', [], { transform: toArray })

const searchStatus = ref<'idle' | 'pending' | 'success'>('idle')
const collapsibleSearchOptions = ref(!!(itemIds.value.length || tags.value.length))

// テキスト入力はdebounce付きでURL更新（historyの蓄積を防ぐため）
const localQ = ref(q.value)
watch(q, (val) => (localQ.value = val))
const syncQ = useDebounceFn(() => (q.value = localQ.value), 300)

const query = computed(() => ({
    q: q.value,
    itemId: itemIds.value,
    tag: tags.value,
    limit: SETUP_SEARCH_PER_PAGE,
}))

const { setups, status, pagination, loadMore, refresh } = useSetupsList(undefined, {
    query,
    immediate: false,
    watch: false,
})

const search = async () => {
    if (!q.value.length && !itemIds.value.length && !tags.value.length) {
        searchStatus.value = 'idle'
        setups.value = []
        return
    }

    searchStatus.value = 'pending'
    await refresh()
    searchStatus.value = 'success'
}

// URLの変化（戻る・進む含む）を監視して検索を実行
watch(
    [q, itemIds, tags],
    () => {
        if (itemIds.value.length) collapsibleSearchOptions.value = true
        if (tags.value.length) collapsibleSearchOptions.value = true
        search()
    },
    { deep: true },
)

await search()

useSeo({
    title: t('search.title'),
    description: t('search.description'),
    image: '/ogp_2.png',
    twitterCard: 'summary_large_image',
})
</script>

<template>
    <div class="flex w-full flex-col items-stretch gap-8">
        <h1 class="text-highlighted text-2xl leading-none font-semibold text-nowrap">
            {{ $t('search.title') }}
        </h1>

        <div class="flex w-full flex-col gap-3">
            <UInput
                v-model="localQ"
                icon="mingcute:search-line"
                :placeholder="$t('search.keyword')"
                :aria-label="$t('search.keyword')"
                size="xl"
                @input="syncQ"
            />

            <SetupsSearchOptions
                v-model:open="collapsibleSearchOptions"
                v-model:items="itemIds"
                v-model:tags="tags"
            />
        </div>

        <USeparator />

        <SetupsSearchPopularAvatars
            v-if="searchStatus === 'idle'"
            @select="(id) => (itemIds = [...itemIds, id])"
        />

        <div v-else-if="setups.length" class="flex flex-col gap-2 lg:grid lg:grid-cols-1">
            <SetupsList :setups :loading="status === 'pending'" />
            <UButton
                v-if="pagination?.hasNext"
                :loading="status === 'pending'"
                :label="$t('more')"
                @click="loadMore"
            />
        </div>

        <Icon
            v-else-if="searchStatus === 'pending'"
            name="svg-spinners:ring-resize"
            size="32"
            class="text-muted self-center"
        />

        <p v-else class="text-center text-zinc-700 dark:text-zinc-300">
            {{ $t('search.notFound') }}
        </p>
    </div>
</template>
