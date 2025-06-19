<script setup lang="ts">
const session = await useGetSession()
const route = useRoute()
const router = useRouter()

type Tab = 'latest' | 'me' | 'bookmarks'

const tab = ref<Tab>((route.query.tab as Tab) || 'latest')

const changeTab = (newTab: Tab) => {
    tab.value = newTab
    router.push({ query: { tab: newTab !== 'latest' ? newTab : undefined } })
}

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
                    :variant="tab === 'latest' ? 'solid' : 'ghost'"
                    color="neutral"
                    class="px-4 py-2"
                    @click="changeTab('latest')"
                />
                <UButton
                    label="自分の投稿"
                    :variant="tab === 'me' ? 'solid' : 'ghost'"
                    color="neutral"
                    class="px-4 py-2"
                    @click="changeTab('me')"
                />
                <UButton
                    label="ブックマーク"
                    :variant="tab === 'bookmarks' ? 'solid' : 'ghost'"
                    color="neutral"
                    class="px-4 py-2"
                    @click="changeTab('bookmarks')"
                />
            </div>
            <SetupsListLatest v-if="tab === 'latest'" />
            <SetupsListUser v-if="tab === 'me'" :user-id="session?.user.id" />
            <SetupsListBookmarks v-if="tab === 'bookmarks'" />
        </div>

        <SetupsListLatest v-else />
    </div>
</template>
