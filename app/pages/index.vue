<script setup lang="ts">
import { motion } from 'motion-v'

const { getSession } = useAuth()
const session = await getSession()
const route = useRoute()
const router = useRouter()
const { login } = useAppOverlay()

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
    twitterCard: 'summary_large_image',
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
        <UPageHero
            v-if="!session"
            :ui="{ container: 'pt-18 sm:pt-24 lg:pt-32', title: 'sm:text-6xl' }"
        >
            <template #title>
                <motion.h1
                    :initial="{
                        opacity: 0,
                        filter: 'blur(30px)',
                    }"
                    :animate="{
                        opacity: 1,
                        filter: 'blur(0px)',
                    }"
                    :transition="{
                        duration: 0.5,
                    }"
                    class="wrap-anywhere break-keep"
                >
                    お気に入りの<wbr />改変を<wbr />記録して<wbr />共有しよう
                </motion.h1>
            </template>

            <template #description>
                <motion.p
                    :initial="{
                        opacity: 0,
                        filter: 'blur(20px)',
                    }"
                    :animate="{
                        opacity: 1,
                        filter: 'blur(0px)',
                    }"
                    :transition="{
                        duration: 0.5,
                        delay: 0.3,
                    }"
                    class="wrap-anywhere break-keep"
                >
                    あのアイテムって<wbr />どれだっけ？
                    <wbr />記録しておけば、<wbr />もう忘れません。
                </motion.p>
            </template>

            <template #links>
                <motion.div
                    :initial="{
                        opacity: 0,
                        filter: 'blur(20px)',
                    }"
                    :animate="{
                        opacity: 1,
                        filter: 'blur(0px)',
                    }"
                    :transition="{
                        duration: 0.5,
                        delay: 0.5,
                    }"
                >
                    <UButton
                        label="ログイン"
                        color="neutral"
                        variant="outline"
                        class="rounded-full px-6 pt-2.5 pb-2 hover:bg-zinc-700 hover:text-zinc-200 hover:dark:bg-zinc-300 hover:dark:text-zinc-800"
                        @click="login.open()"
                    />
                </motion.div>
            </template>
        </UPageHero>

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
            <SetupsListUser v-if="tab === 'me'" :username="session?.user.username!" />
            <SetupsListBookmarks v-if="tab === 'bookmarks'" />
        </div>

        <SetupsListLatest v-else />
    </div>
</template>
