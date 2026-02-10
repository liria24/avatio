<script setup lang="ts">
import { motion } from 'motion-v'

const { session } = useAuth()
const route = useRoute()
const router = useRouter()
const { login } = useAppOverlay()
const { t } = useI18n()

type Tab = 'latest' | 'owned' | 'bookmarked'

const tab = ref<Tab>((route.query.tab as Tab) || 'latest')

const changeTab = (newTab: Tab) => {
    tab.value = newTab
    router.replace({ query: { tab: newTab !== 'latest' ? newTab : undefined } })
}

defineSeo({
    type: 'website',
    title: t('index.seo.title'),
    titleTemplate: '%s',
    description: t('index.seo.description'),
    image: 'https://avatio.me/ogp_2.png',
    twitterCard: 'summary_large_image',
})
useSchemaOrg([
    defineWebSite({
        name: t('index.seo.title'),
        description: t('index.seo.description'),
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
                    v-html="$t('index.hero.title')"
                />
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
                    v-html="$t('index.hero.description')"
                />
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
                        :label="$t('login')"
                        color="neutral"
                        variant="outline"
                        class="hover:bg-inverted hover:text-inverted rounded-full px-6 py-2"
                        @click="login.open()"
                    />
                </motion.div>
            </template>
        </UPageHero>

        <div v-if="session" class="flex w-full flex-col items-start gap-5">
            <h1 class="text-lg font-medium text-nowrap">{{ $t('index.tabs.latest') }}</h1>
            <div class="flex flex-wrap items-center gap-1">
                <UButton
                    :label="$t('index.tabs.latest')"
                    :active="tab === 'latest'"
                    variant="ghost"
                    active-variant="solid"
                    color="neutral"
                    class="px-4 py-2"
                    @click="changeTab('latest')"
                />
                <UButton
                    :label="$t('index.tabs.me')"
                    :active="tab === 'owned'"
                    variant="ghost"
                    active-variant="solid"
                    color="neutral"
                    class="px-4 py-2"
                    @click="changeTab('owned')"
                />
                <UButton
                    :label="$t('index.tabs.bookmarks')"
                    :active="tab === 'bookmarked'"
                    variant="ghost"
                    active-variant="solid"
                    color="neutral"
                    class="px-4 py-2"
                    @click="changeTab('bookmarked')"
                />
            </div>
            <SetupsList :type="tab" />
        </div>

        <SetupsList v-else type="latest" />
    </div>
</template>
