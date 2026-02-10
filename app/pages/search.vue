<script lang="ts" setup>
const route = useRoute()
const router = useRouter()

// 配列の正規化関数
const normalizeArray = (value: unknown): string[] => {
    if (Array.isArray(value))
        return value.filter((item): item is string => typeof item === 'string')
    return value ? [String(value)] : []
}

// URLからの検索パラメータ（computed - 単一の情報源）
const searchQuery = computed(() => (route.query.q as string) || '')
const searchItemIds = computed(() => normalizeArray(route.query.itemId))
const searchTags = computed(() => normalizeArray(route.query.tag))

// 検索API用のqueryオブジェクト
const query = computed(() => ({
    q: searchQuery.value,
    itemId: searchItemIds.value,
    tag: searchTags.value,
    page: 1,
    limit: SETUP_SEARCH_PER_PAGE,
}))

const shouldShowDetails = computed(() => !!(searchItemIds.value.length || searchTags.value.length))
const searchStatus = ref<'idle' | 'pending' | 'success'>('idle')
const collapsibleSearchOptions = ref(shouldShowDetails.value)

// ローカルの編集用state(URL更新前の一時的な値)
const localQ = ref(searchQuery.value)
const localItemIds = ref([...searchItemIds.value])
const localTags = ref([...searchTags.value])

const { setups, status, pagination, refresh } = useSetupsList(undefined, {
    query,
    immediate: false,
    watch: false,
})

const search = async () => {
    const hasSearchParams =
        query.value.q.length || query.value.itemId.length || query.value.tag.length

    if (!hasSearchParams) {
        searchStatus.value = 'idle'
        setups.value = []
        return
    }

    searchStatus.value = 'pending'
    await refresh()
    searchStatus.value = 'success'
}

const loadMoreSetups = async () => {
    if (pagination.value?.hasNext) {
        query.value.page += 1
        await refresh()
    }
}

// URLクエリパラメータを更新する関数（debounce付き）
const updateRouteQuery = useDebounceFn(() => {
    const queryParams: Record<string, string | string[] | number> = {}

    if (localQ.value) queryParams.q = localQ.value
    if (localItemIds.value.length) queryParams.itemId = localItemIds.value
    if (localTags.value.length) queryParams.tag = localTags.value

    router.push({
        path: route.path,
        query: queryParams,
    })
}, 300)

// ローカルstateの変更を監視してURL更新をトリガー
watch(
    [localItemIds, localTags],
    () => {
        if (localItemIds.value.length) collapsibleSearchOptions.value = true
        if (localTags.value.length) collapsibleSearchOptions.value = true
        updateRouteQuery()
    },
    { deep: true }
)

// route.queryの変更を監視して検索を実行（戻る・進む対応）
watch(
    () => route.query,
    () => {
        // ローカルstateを同期
        localQ.value = searchQuery.value
        localItemIds.value = [...searchItemIds.value]
        localTags.value = [...searchTags.value]

        if (searchItemIds.value.length) collapsibleSearchOptions.value = true
        if (searchTags.value.length) collapsibleSearchOptions.value = true

        // 検索実行
        search()
    },
    { deep: true }
)

// 初期検索の実行
await search()

const { t } = useI18n()

defineSeo({
    title: t('search.title'),
    description: t('search.description'),
    image: 'https://avatio.me/ogp.png',
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
                @input="updateRouteQuery"
            />

            <SetupsSearchOptions
                v-model:open="collapsibleSearchOptions"
                v-model:items="localItemIds"
                v-model:tags="localTags"
            />
        </div>

        <USeparator />

        <!-- 人気アバター表示 -->
        <SetupsSearchPopularAvatars
            v-if="searchStatus === 'idle'"
            @select="
                (id) => {
                    localItemIds.push(id)
                    updateRouteQuery()
                }
            "
        />

        <!-- 検索結果表示 -->
        <div v-else-if="setups.length" class="flex flex-col gap-2 lg:grid lg:grid-cols-1">
            <SetupsList v-model:setups="setups" v-model:status="status" />
            <UButton
                v-if="pagination?.hasNext"
                :loading="status === 'pending'"
                :label="$t('more')"
                @click="loadMoreSetups"
            />
        </div>

        <!-- ロード中 -->
        <Icon
            v-else-if="searchStatus === 'pending'"
            name="svg-spinners:ring-resize"
            size="32"
            class="text-muted self-center"
        />

        <!-- 結果なし表示 -->
        <p v-else class="text-center text-zinc-700 dark:text-zinc-300">
            {{ $t('search.notFound') }}
        </p>
    </div>
</template>
