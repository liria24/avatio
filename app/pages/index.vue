<script setup lang="ts">
const { session } = useAuth()
const login = useLoginModal()
const { t, locale } = useI18n()

const dev = import.meta.dev

const { data: titles } = useFetch('/api/changelogs', {
    key: computed(() => `changelog-titles-${locale.value}`),
    dedupe: 'defer',
    query: { lang: locale.value },
    watch: [locale],
    transform: (response) => response.data.map((item) => item.title),
    default: () => [],
})

type Tab = 'latest' | 'owned' | 'bookmarked'

const _tab = useRouteQuery<Tab | null>('tab', null, { mode: 'push' })

const tab = computed<Tab>({
    get() {
        const val = _tab.value
        if (val === 'owned' || val === 'bookmarked') return val
        return 'latest'
    },
    set(newTab: Tab) {
        _tab.value = newTab !== 'latest' ? newTab : null
    },
})

const showPrivate = ref(true)

useSeo({
    title: t('index.seo.title'),
    titleTemplate: '%s',
    description: t('index.seo.description'),
    image: '/ogp_2.png',
    twitterCard: 'summary_large_image',
    schemaOrg: {
        webSite: true,
    },
})
</script>

<template>
    <div class="flex w-full flex-col gap-6">
        <UPageHero
            v-if="!session"
            :ui="{
                container: 'py-12 sm:py-18 lg:py-26',
                title: 'sm:text-6xl wrap-anywhere break-keep',
                headline: 'mb-6',
            }"
        >
            <template v-if="titles.length" #headline>
                <UButton
                    :to="$localePath('/changelogs')"
                    :prefetch="!dev"
                    :label="titles[0]"
                    variant="soft"
                    color="neutral"
                    style="animation-delay: 0.5s"
                    class="fade-in-blur rounded-full px-4"
                />
            </template>

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
            <div class="flex w-full items-center gap-1">
                <UButton
                    :label="$t('index.tabs.latest')"
                    :active="tab === 'latest'"
                    variant="ghost"
                    active-variant="solid"
                    color="neutral"
                    class="px-4 py-2"
                    @click="tab = 'latest'"
                />
                <UButton
                    :label="$t('index.tabs.me')"
                    :active="tab === 'owned'"
                    variant="ghost"
                    active-variant="solid"
                    color="neutral"
                    class="px-4 py-2"
                    @click="tab = 'owned'"
                />
                <UButton
                    :label="$t('index.tabs.bookmarks')"
                    :active="tab === 'bookmarked'"
                    variant="ghost"
                    active-variant="solid"
                    color="neutral"
                    class="px-4 py-2"
                    @click="tab = 'bookmarked'"
                />

                <USwitch
                    v-if="tab === 'owned'"
                    v-model="showPrivate"
                    :aria-label="$t('index.showPrivate')"
                    size="sm"
                    class="ml-auto"
                >
                    <template #label>
                        <Icon name="mingcute:lock-fill" size="16" />
                    </template>
                </USwitch>
            </div>
            <SetupsList :type="tab" :include-private="showPrivate" />
        </div>

        <template v-else>
            <h1 class="text-lg font-medium text-nowrap">{{ $t('index.tabs.latest') }}</h1>
            <SetupsList type="latest" />
        </template>
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
