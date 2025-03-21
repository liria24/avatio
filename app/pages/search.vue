<script lang="ts" setup>
interface Query {
    q?: string;
    item?: string;
    tag?: string | string[];
}
const route = useRoute();
const client = useSupabaseClient();
const query = ref<Query>(route.query);

const loading = ref(false);
const hasMore = ref(false);
const searchWord = ref<string>((route.query.q as string) ?? '');
const resultSetups = ref<SetupClient[]>([]);
const resultItem = ref<Item | null>(null);
const page = ref<number>(0);
const perPage = 20;

const popularAvatars = ref<{ id: number; name: string; thumbnail: string }[]>(
    []
);
const { data } = await client.rpc('popular_avatars').limit(24);
if (data) popularAvatars.value = data;

const search = async ({
    word,
    items,
    tags,
    page,
}: {
    word: string;
    items: number[];
    tags: string[];
    page: number;
}) => {
    loading.value = true;

    const { data } = await client
        .rpc(
            'search_setups',
            {
                word: word,
                items: items,
                tags: tags,
                page: page,
                per_page: perPage,
            },
            { get: true }
        )
        .overrideTypes<{
            results: (Omit<SetupDB, 'tags'> & { tags: string[] })[];
            has_more: boolean;
        }>();

    if (data) {
        resultSetups.value = [
            ...resultSetups.value,
            ...data.results.map((s) => {
                const setup = { ...s, tags: s.tags.map((t) => ({ tag: t })) };
                return setupMoldingClient(setup);
            }),
        ];
        hasMore.value = data.has_more;
    }
    loading.value = false;
};

const pagenate = async (options?: { initiate?: boolean }) => {
    if (options?.initiate) page.value = 0;
    else page.value++;

    await search({
        word: searchWord.value,
        items: query.value.item ? [parseInt(query.value.item)] : [],
        tags: query.value.tag
            ? Array.isArray(query.value.tag)
                ? query.value.tag
                : [query.value.tag]
            : [],
        page: page.value,
    });
};

// クエリパラメータの変更を監視
watch(
    () => route.query,
    async (newQuery: Query) => {
        query.value = newQuery;
        searchWord.value = newQuery.q ?? '';
        resultItem.value = null;
        resultSetups.value = [];

        if (newQuery.item)
            resultItem.value = await useFetchBooth(parseInt(newQuery.item));

        return pagenate({ initiate: true });
    },
    { immediate: true }
);

useOGP({
    title: 'セットアップ検索',
});
</script>

<template>
    <!-- <div class="w-full flex">
        <div v-if="false" class="hidden w-80 sm:flex flex-col gap-1 px-2">
            <UiTitle label="検索オプション" icon="lucide:menu" />
        </div>
    </div> -->
    <div class="w-full flex flex-col items-stretch gap-5">
        <div class="w-full flex flex-col gap-3 pt-4">
            <!-- <UiTitle
                    label="セットアップ検索"
                    icon="lucide:search"
                    size="lg"
                /> -->
            <UiTextinput
                v-model="searchWord"
                icon="lucide:search"
                placeholder="キーワード検索"
                aria-label="キーワード検索"
                class="mt-1"
                @keyup.enter="navigateTo('/search?q=' + searchWord)"
            />
        </div>

        <SetupsViewerItem
            v-if="resultItem"
            :size="'lg'"
            no-action
            :item="resultItem"
        />

        <UiDivider class="mx-3 my-5" />

        <div
            v-if="!Object.keys(query).length && popularAvatars.length"
            class="flex flex-col gap-6"
        >
            <UiTitle
                label="人気のアバターから検索"
                icon="lucide:user-round"
                size="lg"
            />
            <div class="flex flex-wrap gap-5 items-center justify-center">
                <NuxtLink
                    v-for="i in popularAvatars"
                    :key="useId()"
                    :to="`/search?item=${i.id}`"
                    :aria-label="i.name"
                    class="group relative size-32 rounded-lg overflow-hidden"
                >
                    <div
                        class="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-200"
                    >
                        <span
                            class="p-1 text-sm text-center font-semibold text-white"
                        >
                            {{ useAvatarName(i.name) }}
                        </span>
                    </div>
                    <NuxtImg
                        v-slot="{ src, isLoaded }"
                        :src="i.thumbnail"
                        :alt="i.name"
                        :width="256"
                        :height="256"
                        format="webp"
                        fit="cover"
                        loading="lazy"
                        class="rounded-lg shrink-0 overflow-hidden"
                    >
                        <img
                            v-if="isLoaded"
                            :src="src"
                            :width="256"
                            :height="256"
                        />
                        <Icon
                            v-else
                            name="svg-spinners:ring-resize"
                            size="36"
                            class="text-zinc-600 dark:text-zinc-300"
                        />
                    </NuxtImg>
                </NuxtLink>
            </div>
        </div>

        <template v-if="Object.keys(query).length">
            <div
                v-if="resultSetups.length"
                class="flex flex-col lg:grid lg:grid-cols-1 gap-2"
            >
                <SetupsListBase :setups="resultSetups" />
                <ButtonLoadMore
                    v-if="hasMore"
                    :loading="loading"
                    class="w-full"
                    @click="pagenate()"
                />
            </div>

            <p v-else class="text-center text-zinc-700 dark:text-zinc-300">
                セットアップが見つかりませんでした
            </p>
        </template>
    </div>
</template>
