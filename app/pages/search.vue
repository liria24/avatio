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

interface Query {
    q: string
    itemId: string[]
    tag: string[]
    page: number
    perPage: number
}
const query = reactive<Query>({
    q: (route.query.q as string) || '',
    itemId: Array.isArray(route.query.itemId)
        ? route.query.itemId.filter((id): id is string => id != null)
        : route.query.itemId != null
          ? [route.query.itemId as string]
          : [],
    tag: Array.isArray(route.query.tag)
        ? route.query.tag.filter((tag): tag is string => tag != null)
        : route.query.tag != null
          ? [route.query.tag as string]
          : [],
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

const {
    setups: fetchedSetups,
    hasMore,
    status,
    fetchSetups,
} = await useFetchSetups({
    query,
    getCachedData: undefined,
    immediate: false,
})

const setups = ref<Setup[]>([])
const queryItems = ref<Item[]>([])

const loadMoreSetups = () => {
    if (hasMore.value) {
        query.page += 1
        fetchSetups()
    }
}

const search = async () => {
    if (!query.q.length && !query.itemId.length && !query.tag.length) {
        router.push({
            query: {
                q: undefined,
                itemId: undefined,
                tag: undefined,
            },
        })
        await fetchPopularAvatars()
        isSearched.value = false
        return
    }

    if (query.itemId.length)
        for (const id of query.itemId)
            if (!queryItems.value.some((item) => item.id === id)) {
                const item = await $fetch<Item | null>(`/api/item/${id}`)
                if (item) queryItems.value.push(item)
            }

    query.page = 1
    setups.value = []
    router.push({
        query: {
            q: query.q.length ? query.q : undefined,
            itemId: query.itemId.length ? query.itemId : undefined,
            tag: query.tag.length ? query.tag : undefined,
        },
    })
    await fetchSetups()
    setups.value = fetchedSetups.value || []
    isSearched.value = true
}

const onSelectPopularAvatar = (id: string) => {
    if (!query.itemId.includes(id)) {
        query.itemId.push(id)
    }
    search()
}

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
                :default-open="
                    !!(
                        query.itemId?.length ||
                        query.tag?.length ||
                        query.q?.length
                    )
                "
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
                                <div v-for="item in queryItems" :key="item.id">
                                    <NuxtImg
                                        :src="item.image || undefined"
                                        :height="100"
                                        class="h-12 rounded-lg"
                                    />
                                </div>
                                <UButton
                                    :label="
                                        query.itemId.length
                                            ? undefined
                                            : 'アイテムを選択'
                                    "
                                    icon="lucide:plus"
                                    variant="ghost"
                                    class="p-4"
                                />
                            </div>
                        </div>

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
                                :class="[
                                    'flex w-full flex-wrap items-center gap-2 rounded-lg p-2',
                                    'ring-1 ring-zinc-400 ring-inset focus-within:ring-2 focus-within:ring-zinc-700 hover:ring-2 dark:ring-zinc-700',
                                ]"
                            >
                                <TagsInputItem
                                    v-for="item in query.tag"
                                    :key="item"
                                    :value="item"
                                    class="flex items-center justify-center gap-1.5 rounded-full border border-zinc-300 px-1 py-1 dark:border-zinc-600"
                                >
                                    <TagsInputItemText class="pl-2 text-sm" />
                                    <TagsInputItemDelete
                                        :class="[
                                            'flex cursor-pointer items-center justify-center rounded-full p-1',
                                            'hover:bg-zinc-300 hover:dark:bg-zinc-700',
                                            'transition duration-100 ease-in-out',
                                        ]"
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
                    :aria-label="avatar.name"
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

        <div
            v-else-if="setups.length"
            class="flex flex-col gap-2 lg:grid lg:grid-cols-1"
        >
            <SetupsList v-model:setups="setups" v-model:status="status" />
            <UButton
                v-if="hasMore"
                :loading="status === 'pending'"
                label="もっと見る"
                @click="loadMoreSetups()"
            />
        </div>

        <p v-else class="text-center text-zinc-700 dark:text-zinc-300">
            セットアップが見つかりませんでした
        </p>
    </div>
</template>
