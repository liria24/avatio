<script lang="ts" setup>
import {
    TagsInputRoot,
    TagsInputItem,
    TagsInputItemText,
    TagsInputItemDelete,
    TagsInputInput,
} from 'reka-ui'

const route = useRoute()
const router = useRouter()
const nuxtApp = useNuxtApp()

const isSearched = ref(false)
const openedItemSearchPopover = ref(false)

interface Query {
    q: string
    itemId: string[]
    tag: string[]
    page: number
    perPage: number
}

// 配列の正規化関数
const normalizeArray = (value: unknown): string[] => {
    if (Array.isArray(value)) {
        return value.filter((item): item is string => typeof item === 'string')
    }
    return value != null ? [String(value)] : []
}

const query = reactive<Query>({
    q: (route.query.q as string) || '',
    itemId: normalizeArray(route.query.itemId),
    tag: normalizeArray(route.query.tag),
    page: 1,
    perPage: 50,
})

const { data: popularAvatars, refresh: fetchPopularAvatars } = await useFetch(
    '/api/item/popular-avatars',
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
    getCachedData: undefined,
    immediate: false,
    watch: false,
})

const setups = ref<Setup[]>([])
const queryItems = ref<Item[]>([])

// アイテムの重複チェック
const hasQueryItem = (id: string) =>
    queryItems.value.some((item) => item.id === id)

// アイテムを非同期で取得
const fetchItemsById = async (ids: string[]) => {
    const newIds = ids.filter((id) => !hasQueryItem(id))

    for (const id of newIds) {
        try {
            const item = await $fetch<Item | null>(`/api/item/${id}`)
            if (item) {
                queryItems.value.push(item)
            }
        } catch (error) {
            console.error(`Failed to fetch item with ID ${id}:`, error)
        }
    }
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
        isSearched.value = false
        return
    }

    if (query.itemId.length) {
        await fetchItemsById(query.itemId)
    }

    await refresh()
    setups.value = data.value?.data || []
    isSearched.value = true
}

const updateQuery = (updates: Partial<Pick<Query, 'itemId' | 'tag'>>) => {
    router.push({
        query: {
            ...route.query,
            ...Object.fromEntries(
                Object.entries(updates).map(([key, value]) => [
                    key,
                    Array.isArray(value) && value.length ? value : undefined,
                ])
            ),
        },
    })
}

const onSelectPopularAvatar = (id: string) => {
    if (!query.itemId.includes(id)) {
        updateQuery({ itemId: [...query.itemId, id] })
    }
}

const onSelectItemSearch = (id: string) => {
    if (!query.itemId.includes(id)) {
        updateQuery({ itemId: [...query.itemId, id] })
    }
    openedItemSearchPopover.value = false
}

const removeQueryItem = (id: string) => {
    const newItemIds = query.itemId.filter((itemId) => itemId !== id)
    queryItems.value = queryItems.value.filter((item) => item.id !== id)
    updateQuery({ itemId: newItemIds })
}

// URLクエリの変更を監視
watch(
    () => route.query,
    (newQuery) => {
        console.log('Route query changed:', newQuery)

        Object.assign(query, {
            q: (newQuery.q as string) || '',
            itemId: normalizeArray(newQuery.itemId),
            tag: normalizeArray(newQuery.tag),
            page: 1,
        })

        setups.value = []
        isSearched.value = false
        search()
    }
)

// 詳細オプションの表示状態
const shouldShowDetails = computed(
    () => !!(query.itemId?.length || query.tag?.length || query.q?.length)
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
                :default-open="shouldShowDetails"
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

                                <UPopover
                                    v-model:open="openedItemSearchPopover"
                                    :content="{ side: 'right', align: 'start' }"
                                >
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
                                        <ItemSearch
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

                            <TagsInputRoot
                                v-model="query.tag"
                                class="ring-accented flex w-full flex-wrap items-center gap-2 rounded-lg p-2 ring-1 ring-inset focus-within:ring-2 hover:ring-2"
                            >
                                <TagsInputItem
                                    v-for="item in query.tag"
                                    :key="item"
                                    :value="item"
                                    class="flex items-center justify-center gap-1.5 rounded-full border border-zinc-300 px-1 py-1 dark:border-zinc-600"
                                >
                                    <TagsInputItemText class="pl-2 text-sm" />
                                    <TagsInputItemDelete
                                        class="flex cursor-pointer items-center justify-center rounded-full p-1 transition duration-100 ease-in-out hover:bg-zinc-300 hover:dark:bg-zinc-700"
                                    >
                                        <Icon name="lucide:x" />
                                    </TagsInputItemDelete>
                                </TagsInputItem>

                                <TagsInputInput
                                    id="tagInput"
                                    placeholder="タグを入力"
                                    class="flex-1 bg-transparent px-1 text-sm focus:outline-hidden"
                                />
                            </TagsInputRoot>
                        </div>
                    </div>
                </template>
            </UCollapsible>
        </div>

        <USeparator />

        <!-- 人気アバター表示 -->
        <div v-if="!isSearched" class="flex flex-col gap-6">
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
                        v-slot="{ src, isLoaded }"
                        :src="avatar.image || undefined"
                        :alt="avatar.name"
                        :width="256"
                        :height="256"
                        format="webp"
                        fit="cover"
                        loading="lazy"
                        class="shrink-0 overflow-hidden rounded-lg"
                    >
                        <img
                            v-if="isLoaded"
                            :src="src"
                            :alt="avatar.name"
                            :width="256"
                            :height="256"
                        />
                        <USkeleton
                            v-else
                            :width="256"
                            :height="256"
                            class="h-full w-full"
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
