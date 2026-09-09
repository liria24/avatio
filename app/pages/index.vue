<script setup lang="ts">
const { user, loggedIn, preferences } = useViewerContext()
const login = useLoginModal()
const { t, locale } = useI18n()
const { update } = useUserSettingsUpdate()

const { data: latestChangelog } = useFetch('/api/changelogs/latest', {
    key: computed(() => `latest-changelog-${locale.value}`),
    query: { lang: locale.value },
    dedupe: 'defer',
    immediate: !loggedIn.value,
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

const showPrivate = ref(preferences.value.showPrivateSetups)
const entrance = useSetupEntrance()
const displayedTab = computed<Tab>(() => (loggedIn.value ? tab.value : 'latest'))
const showPrivateDebounced = refDebounced(showPrivate, 300)

watch(
    () => preferences.value.showPrivateSetups,
    (value) => (showPrivate.value = value),
)

const setupsLatest = useSetupsList('latest', {
    immediate: displayedTab.value === 'latest',
    onAppend: (ids) => entrance.append('latest', ids),
})
const setupsOwned = useSetupsList('owned', {
    username: computed(() => user.value?.username ?? undefined),
    query: computed(() => ({ includePrivate: showPrivateDebounced.value })),
    immediate: loggedIn.value && tab.value === 'owned',
})
const setupsBookmarked = useSetupsList('bookmarked', {
    immediate: loggedIn.value && tab.value === 'bookmarked',
})
const lists = {
    latest: setupsLatest,
    owned: setupsOwned,
    bookmarked: setupsBookmarked,
}
const activeList = computed(() => lists[displayedTab.value])
const setups = computed(() => activeList.value.setups.value)
const loading = computed(() => activeList.value.status.value === 'pending')

watch(
    displayedTab,
    (value) => {
        entrance.display(value, false, [])
        if (lists[value].status.value === 'idle') void lists[value].refresh()
    },
    { flush: 'sync' },
)

const cardEntrance = computed(() => {
    // SSR fetches can finish after setup; commit the first display when rendering the result.
    return entrance.display(
        displayedTab.value,
        activeList.value.status.value === 'success',
        setups.value.map((setup) => setup.id),
    )
})

useInfiniteScroll(import.meta.client ? document : undefined, () => setupsLatest.loadMore(), {
    distance: 600,
    canLoadMore: () =>
        (!loggedIn.value || tab.value === 'latest') &&
        setupsLatest.status.value === 'success' &&
        !!setupsLatest.pagination.value?.hasNext,
})

watchDebounced(
    showPrivateDebounced,
    (val) => {
        if (val !== preferences.value.showPrivateSetups) update({ showPrivateSetups: val })
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
            v-if="!loggedIn"
            :ui="{
                container: 'py-12 sm:py-18 lg:py-26',
                title: 'sm:text-6xl wrap-anywhere break-keep',
                headline: 'mb-6',
            }"
        >
            <template v-if="latestChangelog" #headline>
                <UButton
                    :to="$localePath('/changelogs')"
                    :label="latestChangelog.title"
                    variant="soft"
                    color="neutral"
                    class="rounded-full px-4"
                />
            </template>

            <template #title>
                <span v-html="$t('index.hero.title')" />
            </template>

            <template #description>
                <p class="wrap-anywhere break-keep" v-html="$t('index.hero.description')" />
            </template>

            <template #links>
                <div>
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
            <div v-if="loggedIn" class="flex w-full items-center gap-1">
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

            <SetupsList :key="displayedTab" :setups :loading :entrance="cardEntrance" />
            <UButton
                v-if="(!loggedIn || tab === 'latest') && setupsLatest.pagination.value?.hasNext"
                :loading="loading"
                :label="$t('more')"
                @click="setupsLatest.loadMore()"
            />
        </div>
    </div>
</template>
