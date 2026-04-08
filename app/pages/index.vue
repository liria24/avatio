<script setup lang="ts">
const { session } = useAuth()
const login = useLoginModal()
const { t, locale } = useI18n()
const { update } = useUserSettingsUpdate()

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
        if (newTab === 'latest' && setupsLatest.status.value === 'idle') setupsLatest.refresh()
        else if (newTab === 'owned' && setupsOwned.status.value === 'idle') setupsOwned.refresh()
        else if (newTab === 'bookmarked' && setupsBookmarked.status.value === 'idle')
            setupsBookmarked.refresh()
        _tab.value = newTab !== 'latest' ? newTab : null
    },
})

const showPrivate = ref(session.value?.user.settings?.showPrivateSetups ?? true)
const showPrivateDebounced = refDebounced(showPrivate, 300)

const setupsLatest = useSetupsList('latest', {
    immediate: tab.value === 'latest',
})
const setupsOwned = useSetupsList('owned', {
    username: session.value?.user.username ?? undefined,
    query: computed(() => ({ includePrivate: showPrivateDebounced.value })),
    immediate: !!session.value && tab.value === 'owned',
})
const setupsBookmarked = useSetupsList('bookmarked', {
    immediate: !!session.value && tab.value === 'bookmarked',
})
const setups = computed(() =>
    session.value
        ? tab.value === 'owned'
            ? setupsOwned.setups.value
            : tab.value === 'bookmarked'
              ? setupsBookmarked.setups.value
              : setupsLatest.setups.value
        : setupsLatest.setups.value,
)
const loading = computed(() =>
    session.value
        ? tab.value === 'owned'
            ? setupsOwned.status.value === 'pending'
            : tab.value === 'bookmarked'
              ? setupsBookmarked.status.value === 'pending'
              : setupsLatest.status.value === 'pending'
        : setupsLatest.status.value === 'pending',
)

watchDebounced(
    showPrivateDebounced,
    (val) => {
        update({ showPrivateSetups: val })
    },
    { debounce: 500 },
)

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

        <div class="flex w-full flex-col items-start gap-5">
            <div v-if="session" class="flex w-full items-center gap-1">
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
            <h1 v-else class="text-lg font-medium text-nowrap">{{ $t('index.tabs.latest') }}</h1>

            <SetupsList :setups :loading />
        </div>
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
