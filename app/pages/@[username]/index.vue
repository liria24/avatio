<script lang="ts" setup>
const { session } = useAuth()
const { locale } = useI18n()
const route = useRoute()
const router = useRouter()
const { login, reportUser, muteUser } = useAppOverlay()

const username = computed(() => route.params.username as string)
const { data: user, status: userStatus } = await useUser(username.value)
const { isMuted, unmute } = useUserMute(username.value)

if (userStatus.value === 'success' && !user.value)
    showError({
        status: 404,
        statusText: 'User Not Found',
    })

const links = computed(() =>
    user.value?.links?.map((link) => {
        const attributes = useLinkAttributes(link)
        return {
            label: attributes.label,
            icon: attributes.icon,
            to: link,
        }
    }),
)

type Tab = 'owned' | 'bookmarked'

const canViewBookmarks = computed(
    () => user.value?.settings?.publicBookmarks || session.value?.user.username === username.value,
)

const resolveTab = (queryTab: string | null | undefined): Tab => {
    if (queryTab === 'bookmarked' && canViewBookmarks.value) return 'bookmarked'
    return 'owned'
}

const tab = ref<Tab>(resolveTab(route.query.tab as string))

if (route.query.tab === 'bookmarked' && !canViewBookmarks.value)
    router.replace({ query: { ...route.query, tab: undefined } })

const changeTab = (newTab: Tab) => {
    router.push({ query: { tab: newTab !== 'owned' ? newTab : undefined } })
}

watch(
    () => route.query.tab,
    (newTab) => {
        tab.value = resolveTab(newTab as string)
        if (newTab === 'bookmarked' && !canViewBookmarks.value) {
            router.replace({ query: { ...route.query, tab: undefined } })
        }
    },
)

onBeforeRouteLeave(() => {
    login.close()
    reportUser.close()
    muteUser.close()
})

useSeo({
    title: user.value?.name,
    description: user.value?.bio || undefined,
    image: user.value?.image || undefined,
    schemaOrg: {
        webPage: {
            datePublished: user.value?.createdAt,
        },
        person: {
            sameAs: user.value?.links || undefined,
        },
    },
})
</script>

<template>
    <div
        v-if="(userStatus === 'success' && !user) || userStatus === 'error'"
        class="flex w-full flex-col items-center"
    >
        <p class="mt-5 text-zinc-400">{{ $t('errors.userDataFetchFailed') }}</p>
    </div>

    <div v-else-if="user" class="flex w-full flex-col gap-6 px-2">
        <div class="flex w-full flex-col items-start gap-3">
            <div class="flex w-full items-center gap-6">
                <NuxtImg
                    v-if="user.image"
                    :src="user.image"
                    alt=""
                    :width="88"
                    :height="88"
                    format="avif"
                    preload
                    class="aspect-square size-14 shrink-0 rounded-full object-cover sm:size-20"
                />

                <div
                    v-else
                    class="bg-muted flex size-14 shrink-0 items-center justify-center rounded-full md:size-20"
                >
                    <Icon name="mingcute:user-3-fill" size="32" class="text-muted" />
                </div>

                <div class="flex flex-col gap-1">
                    <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <h1 class="text-2xl font-bold">
                            {{ user.name }}
                        </h1>
                        <UserBadges v-if="user.badges" :badges="user.badges" />
                    </div>

                    <span class="text-muted flex items-center gap-1 font-mono text-sm">
                        @{{ user.username }}
                    </span>
                </div>

                <div class="ml-auto">
                    <ButtonUserFollow
                        v-if="session?.user.username !== username"
                        :username
                        :is-following="user.isFollowing"
                        class="px-5"
                    />
                </div>
            </div>

            <div class="text-muted flex items-center gap-1 px-3 text-sm">
                <template v-if="user.followeesCount || session?.user.username === user.username">
                    <ULink :to="$localePath(`/@${user.username}/following`)">
                        <span class="text-toned font-bold">{{ user.followeesCount }}</span>
                        フォロー
                    </ULink>
                    <Icon name="lucide:dot" size="14" />
                </template>

                <template v-if="user.followersCount || session?.user.username === user.username">
                    <ULink :to="$localePath(`/@${user.username}/followers`)">
                        <span class="text-toned font-bold">{{ user.followersCount }}</span>
                        フォロワー
                    </ULink>
                    <Icon name="lucide:dot" size="14" />
                </template>

                <span>
                    <NuxtTime :datetime="user.createdAt" date-style="short" :locale />
                    に登録
                </span>
            </div>

            <div class="flex w-full flex-col gap-3 px-2 empty:hidden">
                <div v-if="links?.length" class="flex flex-wrap items-center gap-2">
                    <UButton
                        v-for="(link, index) in links"
                        :key="'link-' + index"
                        :to="link.to"
                        target="_blank"
                        external
                        :aria-label="link.label || link.to"
                        :icon="link.icon"
                        variant="ghost"
                    />
                </div>

                <div
                    v-if="user.bio?.length"
                    class="ring-muted flex w-full flex-col gap-1 rounded-xl px-4 py-3 ring-1"
                >
                    <span class="text-dimmed font-mono text-xs leading-none text-nowrap">
                        bio
                    </span>
                    <p class="text-relaxed sentence text-sm whitespace-pre-wrap">
                        {{ user.bio }}
                    </p>
                </div>

                <div class="ml-auto flex items-center gap-1">
                    <UButton
                        v-if="session?.user.username === user.username"
                        :to="$localePath('/settings')"
                        :label="$t('user.editProfile')"
                        icon="mingcute:edit-3-fill"
                        variant="ghost"
                        size="sm"
                    />

                    <template v-else>
                        <UButton
                            :label="isMuted ? 'ミュート解除' : 'ミュート'"
                            icon="mingcute:eye-close-fill"
                            variant="ghost"
                            size="sm"
                            :color="isMuted ? 'error' : undefined"
                            @click="
                                session
                                    ? isMuted
                                        ? unmute()
                                        : muteUser.open({ username: user.username })
                                    : login.open()
                            "
                        />
                        <UButton
                            :label="$t('report')"
                            icon="mingcute:flag-3-fill"
                            variant="ghost"
                            size="sm"
                            @click="
                                session ? reportUser.open({ userId: user.username }) : login.open()
                            "
                        />
                    </template>
                </div>
            </div>
        </div>

        <div v-if="user.shops?.length" class="mb-4 flex w-full flex-col gap-5 px-2">
            <div class="flex items-center gap-2">
                <Icon name="mingcute:store-fill" size="22" class="text-muted" />
                <h2 class="text-xl leading-none font-semibold text-nowrap">
                    {{ $t('user.shops') }}
                </h2>
            </div>

            <div class="flex flex-wrap items-center gap-2">
                <UButton
                    v-for="(shop, index) in user.shops"
                    :key="'shop-' + index"
                    :to="`https://${shop.shop.id}.booth.pm`"
                    target="_blank"
                    external
                    variant="soft"
                    class="gap-3 p-3"
                >
                    <NuxtImg
                        v-slot="{ isLoaded, src, imgAttrs }"
                        :src="shop.shop.image || undefined"
                        :width="32"
                        :height="32"
                        format="avif"
                        fit="cover"
                        custom
                    >
                        <img
                            v-if="isLoaded"
                            v-bind="imgAttrs"
                            :src
                            alt=""
                            loading="lazy"
                            fetchpriority="low"
                            class="aspect-square size-8 shrink-0 rounded-lg object-cover"
                        />
                        <USkeleton v-else class="aspect-square size-8 shrink-0 rounded-lg" />
                    </NuxtImg>
                    <div class="flex flex-col items-start gap-1">
                        <span
                            class="text-sm leading-none font-semibold text-zinc-800 dark:text-zinc-300"
                        >
                            {{ shop.shop.name }}
                        </span>
                        <span
                            class="text-xs leading-none font-normal text-zinc-500 dark:text-zinc-500"
                        >
                            {{ shop.shop.id }}.booth.pm
                        </span>
                    </div>
                </UButton>
            </div>
        </div>

        <USeparator />

        <div class="flex w-full flex-col gap-5 px-2">
            <div class="flex items-center gap-2">
                <Icon name="mingcute:dress-fill" size="22" class="text-muted" />
                <h2 class="text-xl leading-none font-semibold text-nowrap">
                    {{ $t('user.setups') }}
                </h2>
            </div>

            <div
                v-if="user.settings?.publicBookmarks || session?.user.username === username"
                class="flex flex-wrap items-center gap-1"
            >
                <UButton
                    label="投稿"
                    :active="tab === 'owned'"
                    variant="ghost"
                    active-variant="solid"
                    color="neutral"
                    class="px-4 py-2"
                    @click="changeTab('owned')"
                />
                <UButton
                    label="ブックマーク"
                    :active="tab === 'bookmarked'"
                    variant="ghost"
                    active-variant="solid"
                    color="neutral"
                    class="px-4 py-2"
                    @click="changeTab('bookmarked')"
                />

                <UButton
                    v-if="tab === 'bookmarked' && session?.user.username === user.username"
                    :to="$localePath('/settings#privacy')"
                    :icon="
                        user.settings?.publicBookmarks === false
                            ? 'mingcute:lock-fill'
                            : 'mingcute:world-2-fill'
                    "
                    :label="user.settings?.publicBookmarks === false ? '非公開' : '公開'"
                    :color="user.settings?.publicBookmarks ? 'secondary' : undefined"
                    variant="soft"
                    class="ml-auto rounded-full px-3 py-2"
                />
            </div>

            <SetupsList :type="tab" :username="user.username" />
        </div>
    </div>
</template>
