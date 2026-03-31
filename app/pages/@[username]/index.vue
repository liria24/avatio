<script lang="ts" setup>
const { session } = useAuth()
const { locale } = useI18n()
const overlay = useOverlay()
const login = useLoginModal()
const reportUser = useReportUserModal()
const muteUser = useMuteUserModal()
const username = useRouteParams('username', undefined, { transform: String })
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

const _tab = useRouteQuery<Tab | null>('tab', null, { mode: 'push' })

const tab = computed<Tab>({
    get: () => (_tab.value === 'bookmarked' && canViewBookmarks.value ? 'bookmarked' : 'owned'),
    set: (newTab) => {
        _tab.value = newTab !== 'owned' ? newTab : null
    },
})

const { setups: userSetups, status: userSetupsStatus } = useSetupsList('owned', {
    username: user.value?.username,
})
const { setups: bookmarkedSetups, status: bookmarkedSetupsStatus } = useSetupsList('bookmarked', {
    username: user.value?.username,
})

const setups = computed(() =>
    tab.value === 'owned'
        ? userSetups.value
        : canViewBookmarks.value
          ? bookmarkedSetups.value
          : userSetups.value,
)
const loading = computed(() =>
    tab.value === 'owned'
        ? userSetupsStatus.value === 'pending'
        : bookmarkedSetupsStatus.value === 'pending',
)

onBeforeRouteLeave(() => {
    overlay.closeAll()
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
                    variant="ghost"
                    class="gap-3 p-3"
                >
                    <div v-if="shop.shop.image" class="relative">
                        <NuxtImg
                            :src="shop.shop.image"
                            alt=""
                            :width="48"
                            :height="48"
                            format="avif"
                            fit="cover"
                            loading="lazy"
                            fetchpriority="low"
                            class="aspect-square size-22 shrink-0 rounded-lg object-cover sm:size-28"
                        />

                        <div
                            class="inset-ring-inverted/10 pointer-events-none absolute inset-0 rounded-md inset-ring-1"
                        />
                    </div>
                    <div
                        v-else
                        class="bg-muted flex aspect-square size-22 items-center justify-center rounded-lg sm:size-28"
                    >
                        <Icon
                            :name="getPlatformData(shop.shop.platform)?.icon"
                            size="24"
                            class="text-muted"
                        />
                    </div>

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

            <div v-if="canViewBookmarks" class="flex flex-wrap items-center gap-1">
                <UButton
                    label="投稿"
                    :active="tab === 'owned'"
                    variant="ghost"
                    active-variant="solid"
                    color="neutral"
                    class="px-4 py-2"
                    @click="tab = 'owned'"
                />
                <UButton
                    label="ブックマーク"
                    :active="tab === 'bookmarked'"
                    variant="ghost"
                    active-variant="solid"
                    color="neutral"
                    class="px-4 py-2"
                    @click="tab = 'bookmarked'"
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

            <SetupsList :setups :loading />
        </div>
    </div>
</template>
