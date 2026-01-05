<script lang="ts" setup>
const route = useRoute()
const router = useRouter()

// 配列の正規化関数
const normalizeArray = (value: unknown): string[] => {
    if (Array.isArray(value))
        return value.filter((item): item is string => typeof item === 'string')
    return value ? [String(value)] : []
}

interface Query {
    q: string
    itemId: string[]
    tag: string[]
    page: number
    perPage: number
}

// 同期処理中かどうかのフラグ
const isSyncing = ref(false)

// 初期クエリ値の設定
const query = reactive<Query>({
    q: (route.query.q as string) || '',
    itemId: normalizeArray(route.query.itemId),
    tag: normalizeArray(route.query.tag),
    page: 1,
    perPage: 50,
})

// 配列が等しいかチェックするヘルパー関数
const arrayEquals = (a: string[], b: string[]): boolean =>
    a.length === b.length && a.every((val, index) => val === b[index])

// URLクエリパラメータを更新する関数
const updateRouteQuery = () => {
    // 空でないパラメータのみをURLに含める
    const queryParams: Record<string, string | string[] | number> = {}

    if (query.q) queryParams.q = query.q
    if (query.itemId.length) queryParams.itemId = query.itemId
    if (query.tag.length) queryParams.tag = query.tag

    // 現在のルートを維持しながらクエリパラメータのみを更新
    router.replace({
        path: route.path,
        query: queryParams,
    })
}

const shouldShowDetails = computed(() => !!(query.itemId.length || query.tag.length))

const searchStatus = ref<'idle' | 'pending' | 'success'>('idle')
const collapsibleSearchOptions = ref(shouldShowDetails.value)

const { data, status, refresh } = await useSetups({
    query,
    immediate: false,
    watch: false,
})

const setups = ref<SerializedSetup[]>([])

const search = async () => {
    const hasSearchParams = query.q.length || query.itemId.length || query.tag.length

    if (!hasSearchParams) {
        searchStatus.value = 'idle'
        setups.value = []
        return
    }

    searchStatus.value = 'pending'
    await refresh()
    setups.value = data.value?.data || []
    searchStatus.value = 'success'
}

const loadMoreSetups = async () => {
    if (data.value?.pagination.hasNext) {
        query.page += 1
        await search()
    }
}

// route.queryの変更を監視して内部状態を更新
watch(
    () => route.query,
    (newRouteQuery) => {
        if (isSyncing.value) return

        isSyncing.value = true

        // queryオブジェクトを更新
        query.q = (newRouteQuery.q as string) || ''
        query.itemId = normalizeArray(newRouteQuery.itemId)
        query.tag = normalizeArray(newRouteQuery.tag)

        if (newRouteQuery.itemId?.length) collapsibleSearchOptions.value = true
        if (newRouteQuery.tag?.length) collapsibleSearchOptions.value = true

        // 検索実行
        search().finally(() => {
            isSyncing.value = false
        })
    },
    { deep: true }
)

// queryの変更を監視して検索を実行し、URLを更新
watch(
    query,
    async (newQuery, oldQuery) => {
        if (isSyncing.value) return

        // 初回のコンポーネントマウント時は処理をスキップ
        if (oldQuery === undefined) return

        if (newQuery.itemId.length) collapsibleSearchOptions.value = true
        if (newQuery.tag.length) collapsibleSearchOptions.value = true

        // 検索条件に変更があった場合はページをリセット
        if (
            newQuery.q !== oldQuery.q ||
            !arrayEquals(newQuery.itemId, oldQuery.itemId) ||
            !arrayEquals(newQuery.tag, oldQuery.tag)
        )
            query.page = 1

        // 検索実行
        isSyncing.value = true
        await search()

        // URLクエリパラメータを更新
        updateRouteQuery()
        isSyncing.value = false
    },
    { deep: true, immediate: false }
)

// 初期検索の実行
await search()

defineSeo({
    title: 'セットアップ検索',
    description: '条件を指定してセットアップを検索できます。',
    image: 'https://avatio.me/ogp.png',
})
</script>

<template>
    <div class="flex w-full flex-col items-stretch gap-8">
        <h1 class="text-highlighted text-2xl leading-none font-semibold text-nowrap">
            セットアップ検索
        </h1>

        <div class="flex w-full flex-col gap-3">
            <UInput
                v-model="query.q"
                icon="lucide:search"
                placeholder="検索キーワード"
                aria-label="検索キーワード"
                size="xl"
                @keyup.enter="search"
            />

            <SetupsSearchOptions
                v-model:open="collapsibleSearchOptions"
                v-model:items="query.itemId"
                v-model:tags="query.tag"
            />
        </div>

        <USeparator />

        <!-- 人気アバター表示 -->
        <SetupsSearchPopularAvatars
            v-if="searchStatus === 'idle'"
            @select="query.itemId = [...query.itemId, $event]"
        />

        <!-- 検索結果表示 -->
        <div v-else-if="setups.length" class="flex flex-col gap-2 lg:grid lg:grid-cols-1">
            <SetupsList v-model:setups="setups" v-model:status="status" />
            <UButton
                v-if="data?.pagination.hasNext"
                :loading="status === 'pending'"
                label="もっと見る"
                @click="loadMoreSetups"
            />
        </div>

        <!-- 結果なし表示 -->
        <p v-else class="text-center text-zinc-700 dark:text-zinc-300">
            セットアップが見つかりませんでした
        </p>
    </div>
</template>
