<script setup lang="ts">
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
            :ui="{
                container: 'pt-18 sm:pt-24 lg:pt-32',
                title: 'sm:text-6xl wrap-anywhere break-keep',
            }"
        >
            <template #title>
                <span
                    style="animation-delay: 0.3s"
                    class="fade-in-blur"
                    v-html="$t('index.hero.title')"
                />
            </template>

            <template #description>
                <p
                    style="animation-delay: 0.5s"
                    class="fade-in-blur wrap-anywhere break-keep"
                    v-html="$t('index.hero.description')"
                />
            </template>

            <template #links>
                <div style="animation-delay: 0.7s" class="fade-in-blur">
                    <UButton
                        :label="$t('login')"
                        color="neutral"
                        variant="outline"
                        class="hover:bg-inverted hover:text-inverted rounded-full px-6 py-2"
                        @click="login.open()"
                    />
                </div>
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

<style scoped>
@keyframes fadeInBlur {
    from {
        opacity: 0;
        filter: blur(30px);
    }
    to {
        opacity: 1;
        filter: blur(0);
    }
}

.fade-in-blur {
    opacity: 0;
    animation: fadeInBlur 0.7s ease-out forwards;
}
</style>
