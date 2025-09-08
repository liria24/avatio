<script setup lang="ts">
import { LazyModalLogin } from '#components'

const { $session } = useNuxtApp()
const session = await $session()
const route = useRoute()
const router = useRouter()
const overlay = useOverlay()

const modalLogin = overlay.create(LazyModalLogin)

type Tab = 'latest' | 'me' | 'bookmarks'

const tab = ref<Tab>((route.query.tab as Tab) || 'latest')

const changeTab = (newTab: Tab) => {
    tab.value = newTab
    router.replace({ query: { tab: newTab !== 'latest' ? newTab : undefined } })
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
        <div
            v-if="!session"
            class="flex w-full max-w-xl flex-col items-center gap-6 self-center py-12 sm:mt-12 sm:mb-6"
        >
            <LogoAvatio
                by-liria
                aria-label="Avatio by Liria"
                class="w-64 sm:w-96"
            />
            <p class="sm:text-md text-muted text-sm font-medium">
                あなたのアバター改変を共有しよう
            </p>
            <UButton
                v-if="!session"
                label="ログイン"
                variant="outline"
                size="lg"
                color="neutral"
                class="rounded-full px-5 hover:bg-zinc-700 hover:text-zinc-200 hover:dark:bg-zinc-300 hover:dark:text-zinc-800"
                @click="modalLogin.open()"
            />
        </div>

        <div v-if="session" class="flex w-full flex-col items-start gap-5">
            <h1 class="text-lg font-medium text-nowrap">ホーム</h1>
            <div class="flex flex-wrap items-center gap-1">
                <UButton
                    label="最新"
                    :active="tab === 'latest'"
                    variant="ghost"
                    active-variant="solid"
                    color="neutral"
                    class="px-4 py-2"
                    @click="changeTab('latest')"
                />
                <UButton
                    label="自分の投稿"
                    :active="tab === 'me'"
                    variant="ghost"
                    active-variant="solid"
                    color="neutral"
                    class="px-4 py-2"
                    @click="changeTab('me')"
                />
                <UButton
                    label="ブックマーク"
                    :active="tab === 'bookmarks'"
                    variant="ghost"
                    active-variant="solid"
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
