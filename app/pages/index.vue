<script setup lang="ts">
const session = await useGetSession()

const mode = ref<'latest' | 'user' | 'bookmarks'>('latest')

const setupsPerPage: number = 50
const page = ref(1)

const { setups, hasMore, status, fetchMoreSetups } = useFetchSetups({
    query: computed(() => ({
        page: page.value,
        perPage: setupsPerPage,
        userId: (mode.value === 'user' && session.value?.user.id) || null,
    })),
})

defineSeo({
    type: 'website',
    title: 'Avatio',
    titleTemplate: '%s',
    description: 'あなたのアバター改変を共有しよう',
    image: 'https://avatio.me/ogp_2.png',
})
useSchemaOrg([
    defineWebSite({
        name: 'Avatio',
        description: 'あなたのアバター改変を共有しよう',
        inLanguage: 'ja-JP',
        potentialAction: defineSearchAction({
            target: '/search?q={search_term_string}',
        }),
    }),
])
</script>

<template>
    <div class="flex w-full flex-col gap-6">
        <!-- <BannerHeader class="flex sm:hidden" /> -->

        <Hero v-if="!session" class="sm:mt-12 sm:mb-6" />

        <div v-if="session" class="flex w-full flex-col items-start gap-5">
            <h1 class="text-lg font-medium text-nowrap">ホーム</h1>
            <div class="flex flex-wrap items-center gap-1">
                <UButton
                    label="最新"
                    :variant="mode === 'latest' ? 'solid' : 'ghost'"
                    color="neutral"
                    class="px-4 py-2"
                    @click="mode = 'latest'"
                />
                <UButton
                    label="自分の投稿"
                    :variant="mode === 'user' ? 'solid' : 'ghost'"
                    color="neutral"
                    class="px-4 py-2"
                    @click="mode = 'user'"
                />
                <UButton
                    label="ブックマーク"
                    :variant="mode === 'bookmarks' ? 'solid' : 'ghost'"
                    color="neutral"
                    class="px-4 py-2"
                    @click="mode = 'bookmarks'"
                />
            </div>
            <div class="flex w-full flex-col gap-3 self-center">
                <SetupsList :setups="setups" :loading="status === 'pending'" />
                <UButton
                    v-if="hasMore"
                    :loading="status === 'pending'"
                    label="もっと見る"
                    @click="fetchMoreSetups()"
                />
            </div>
        </div>

        <div v-else class="flex w-full flex-col gap-3 self-center">
            <SetupsList :setups="setups" :loading="status === 'pending'" />
            <UButton
                v-if="hasMore"
                :loading="status === 'pending'"
                label="もっと見る"
                @click="fetchMoreSetups()"
            />
        </div>
    </div>
</template>
