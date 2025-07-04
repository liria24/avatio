<script lang="ts" setup>
const route = useRoute()
const router = useRouter()
const nuxtApp = useNuxtApp()

interface Query {
    q: string
    itemId: string[]
    tag: string[]
    page: number
    perPage: number
}

// 配列の正規化関数
const normalizeArray = (value: unknown): string[] => {
    if (Array.isArray(value))
        return value.filter((item): item is string => typeof item === 'string')
    return value ? [String(value)] : []
}

const query = reactive<Query>({
    q: (route.query.q as string) || '',
    itemId: normalizeArray(route.query.itemId),
    tag: normalizeArray(route.query.tag),
    page: 1,
    perPage: 50,
})

const shouldShowDetails = computed(
    () => !!(query.itemId.length || query.tag.length || query.q.length)
)

const searchStatus = ref<'idle' | 'pending' | 'success'>('idle')
const popoverItemSearch = ref(false)
const collapsibleSearchOptions = ref(shouldShowDetails.value)

const { data: popularAvatars, refresh: fetchPopularAvatars } = await useFetch(
    '/api/items/popular-avatars',
    {
        key: 'popular-avatars',
        getCachedData: (key: string) =>
            nuxtApp.payload.data[key] || nuxtApp.static.data[key],
        default: () => [],
        immediate: false,
    }
)

const { data, status, refresh } = await useSetups({
    query,
    immediate: false,
    watch: false,
})

const setups = ref<Setup[]>([])
const queryItems = ref<Item[]>([])

// アイテムを非同期で取得
const fetchItemsById = async (ids: string[]) => {
    const existingIds = new Set(queryItems.value.map((item) => item.id))
    const newIds = ids.filter((id) => !existingIds.has(id))

    const items = await Promise.allSettled(
        newIds.map((id) => $fetch<Item>(`/api/items/${id}`))
    )

    items.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value)
            queryItems.value.push(result.value)
        else if (result.status === 'rejected')
            console.error(
                `Failed to fetch item with ID ${newIds[index]}:`,
                result.reason
            )
    })
}

// queryItemsをクエリパラメータと同期する関数
const syncQueryItems = async (itemIds: string[]) => {
    queryItems.value = queryItems.value.filter((item) =>
        itemIds.includes(item.id)
    )
    if (itemIds.length > 0) await fetchItemsById(itemIds)
}

const loadMoreSetups = () => {
    if (data.value?.pagination.hasNext) {
        query.page += 1
        refresh()
    }
}

const search = async () => {
    const hasSearchParams =
        query.q.length || query.itemId.length || query.tag.length

    if (!hasSearchParams) {
        await fetchPopularAvatars()
        searchStatus.value = 'idle'
        return
    }

    await syncQueryItems(query.itemId)
    searchStatus.value = 'pending'
    await refresh()
    setups.value = data.value?.data || []
    searchStatus.value = 'success'
}

const updateQuery = (updates: Partial<Pick<Query, 'itemId' | 'tag'>>) => {
    const newQuery = { ...route.query }

    Object.entries(updates).forEach(([key, value]) => {
        if (Array.isArray(value) && value.length) newQuery[key] = value
        else {
            const { [key]: removed, ...rest } = newQuery
            Object.assign(newQuery, rest)
        }
    })

    router.push({ query: newQuery })
}

const onSelectPopularAvatar = (id: string) => {
    if (!query.itemId.includes(id))
        updateQuery({ itemId: [...query.itemId, id] })
}

const onSelectItemSearch = (item: Item) => {
    if (!query.itemId.includes(item.id))
        updateQuery({ itemId: [...query.itemId, item.id] })

    popoverItemSearch.value = false
}

const removeQueryItem = (id: string) => {
    updateQuery({ itemId: query.itemId.filter((itemId) => itemId !== id) })
}

// URLクエリの変更を監視
watch(
    () => route.query,
    async (newQuery) => {
        console.log('Route query changed:', newQuery)

        const newItemIds = normalizeArray(newQuery.itemId)
        const newTags = normalizeArray(newQuery.tag)

        // 空の状態から値がある状態に変わった場合はコラプシブルを開く
        if (
            (query.itemId.length === 0 && newItemIds.length > 0) ||
            (query.tag.length === 0 && newTags.length > 0)
        )
            collapsibleSearchOptions.value = true

        Object.assign(query, {
            q: (newQuery.q as string) || '',
            itemId: newItemIds,
            tag: newTags,
            page: 1,
        })

        await syncQueryItems(newItemIds)
        setups.value = []
        searchStatus.value = 'idle'
        await search()
    }
)

await search()
</script>

<template>
    <div class="flex w-full flex-col items-stretch gap-8">
        <h1
            class="text-highlighted text-2xl leading-none font-semibold text-nowrap"
        >
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

            <UCollapsible
                v-model:open="collapsibleSearchOptions"
                class="data-[state=open]:bg-elevated flex flex-col gap-2 rounded-lg"
            >
                <UButton
                    label="詳細オプション"
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    trailing-icon="i-lucide-chevron-down"
                    :ui="{
                        trailingIcon:
                            'group-data-[state=open]:rotate-180 transition-transform duration-200',
                    }"
                    block
                    class="group"
                />

                <template #content>
                    <div class="mx-1 flex w-full flex-col gap-3 rounded-lg p-2">
                        <!-- アイテム選択セクション -->
                        <div class="flex w-full flex-col gap-2">
                            <div class="flex items-center gap-1">
                                <Icon
                                    name="lucide:package"
                                    size="18"
                                    class="text-muted"
                                />
                                <h2
                                    class="text-sm leading-none font-semibold text-nowrap"
                                >
                                    アイテム
                                </h2>
                            </div>

                            <div
                                class="flex w-full flex-wrap items-center gap-2"
                            >
                                <div
                                    v-for="item in queryItems"
                                    :key="item.id"
                                    class="bg-accented flex max-w-56 items-center gap-2 rounded-lg p-2"
                                >
                                    <NuxtImg
                                        :src="item.image || undefined"
                                        :height="100"
                                        class="h-9 rounded-lg"
                                        :alt="item.name"
                                    />
                                    <p class="line-clamp-2 text-xs">
                                        {{ item.name }}
                                    </p>
                                    <UButton
                                        icon="lucide:x"
                                        variant="ghost"
                                        size="sm"
                                        :aria-label="`Remove ${item.name}`"
                                        @click="removeQueryItem(item.id)"
                                    />
                                </div>

                                <UPopover v-model:open="popoverItemSearch">
                                    <UButton
                                        :label="
                                            query.itemId.length
                                                ? undefined
                                                : 'アイテムを選択'
                                        "
                                        icon="lucide:plus"
                                        variant="ghost"
                                        class="p-4"
                                        aria-label="Add item"
                                    />

                                    <template #content>
                                        <CommandPaletteItemSearch
                                            @select="onSelectItemSearch"
                                        />
                                    </template>
                                </UPopover>
                            </div>
                        </div>

                        <!-- タグ入力セクション -->
                        <div class="flex w-full flex-col gap-1.5">
                            <div class="flex items-center gap-1">
                                <Icon
                                    name="lucide:tags"
                                    size="18"
                                    class="text-muted"
                                />
                                <h2
                                    class="text-sm leading-none font-semibold text-nowrap"
                                >
                                    タグ
                                </h2>
                            </div>

                            <UInputTags
                                v-model="query.tag"
                                placeholder="タグを入力"
                                @add-tag="
                                    updateQuery({
                                        tag: [...query.tag, $event as string],
                                    })
                                "
                                @remove-tag="
                                    updateQuery({
                                        tag: query.tag.filter(
                                            (tag) => tag !== $event
                                        ),
                                    })
                                "
                            />
                        </div>
                    </div>
                </template>
            </UCollapsible>
        </div>

        <USeparator />

        <!-- 人気アバター表示 -->
        <div v-if="searchStatus === 'idle'" class="flex flex-col gap-6">
            <div class="flex items-center gap-2">
                <Icon
                    name="lucide:person-standing"
                    size="22"
                    class="text-muted"
                />
                <h2 class="text-xl leading-none font-semibold text-nowrap">
                    人気のアバターから検索
                </h2>
            </div>

            <div class="flex flex-wrap items-center justify-center gap-5">
                <button
                    v-for="(avatar, index) in popularAvatars"
                    :key="`avatar-${index}`"
                    :aria-label="`Search for ${avatar.name}`"
                    class="group relative size-32 cursor-pointer overflow-hidden rounded-lg"
                    @click="onSelectPopularAvatar(avatar.id)"
                >
                    <div
                        class="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100"
                    >
                        <span
                            class="p-1 text-center text-sm font-semibold text-white"
                        >
                            {{ avatarShortName(avatar.name) }}
                        </span>
                    </div>

                    <NuxtImg
                        v-slot="{ src, isLoaded, imgAttrs }"
                        :src="avatar.image || undefined"
                        :alt="avatar.name"
                        :width="256"
                        :height="256"
                        format="webp"
                        fit="cover"
                        loading="lazy"
                    >
                        <img
                            v-if="isLoaded"
                            v-bind="imgAttrs"
                            :src="src"
                            class="aspect-square shrink-0 rounded-lg object-cover"
                        />
                        <USkeleton
                            v-else
                            class="aspect-square shrink-0 rounded-lg object-cover"
                        />
                    </NuxtImg>
                </button>
            </div>
        </div>

        <!-- 検索結果表示 -->
        <div
            v-else-if="setups.length"
            class="flex flex-col gap-2 lg:grid lg:grid-cols-1"
        >
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
