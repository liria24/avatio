<script lang="ts" setup>
const { session } = useAuth()
const { locale } = useI18n()
const route = useRoute()
const { login, reportUser, muteUser } = useAppOverlay()

const username = route.params.username as string

const { data: user, status: userStatus } = await useUser(username)

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

onBeforeRouteLeave(() => {
    login.close()
    reportUser.close()
    muteUser.close()
})

if (user.value) {
    defineSeo({
        title: user.value.name,
        description: user.value.bio || undefined,
        image: user.value.image || undefined,
    })
    useSchemaOrg([
        defineWebPage({
            name: user.value.name,
            description: user.value.bio,
            datePublished: user.value.createdAt,
        }),
        definePerson({
            name: user.value.name,
            description: user.value.bio,
            image: user.value.image || undefined,
            sameAs: user.value.links || undefined,
        }),
    ])
}
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
            <div class="grid w-full items-center gap-3 sm:flex">
                <div class="flex items-center gap-4 sm:gap-6">
                    <NuxtImg
                        v-if="user.image"
                        :src="user.image"
                        alt=""
                        :width="88"
                        :height="88"
                        format="avif"
                        preload
                        class="aspect-square size-20 shrink-0 rounded-full object-cover"
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

                        <span
                            class="text-muted flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-sm break-all"
                        >
                            @{{ user.username }}
                        </span>
                    </div>
                </div>

                <div
                    v-if="session?.user.username !== username"
                    class="mt-3 flex w-full items-center gap-2 sm:mt-0 sm:ml-auto sm:w-fit"
                >
                    <ButtonUserFollow :username class="w-full px-5 sm:w-fit" />
                    <UTooltip text="ミュート">
                        <UButton
                            aria-label="ミュート"
                            icon="mingcute:volume-mute-fill"
                            variant="ghost"
                            class="rounded-full"
                            @click="session ? muteUser.open({ username }) : login.open()"
                        />
                    </UTooltip>
                </div>
            </div>

            <div class="text-muted my-2 flex w-full items-center gap-1 px-3 text-sm empty:hidden">
                <template v-if="user.followersCount">
                    <span>{{ user.followersCount }} フォロワー</span>
                    <Icon name="lucide:dot" size="16" class="text-dimmed" />
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
                        :aria-label="link.label || link.to"
                        :icon="link.icon"
                        variant="ghost"
                    />
                </div>

                <div
                    v-if="user.bio?.length"
                    class="flex w-full flex-col gap-1 rounded-xl border border-zinc-400 px-4 py-3 dark:border-zinc-600"
                >
                    <span class="text-dimmed font-mono text-xs leading-none text-nowrap">
                        bio
                    </span>
                    <p class="text-relaxed sentence text-sm whitespace-pre-wrap">
                        {{ user.bio }}
                    </p>
                </div>
            </div>

            <div class="ml-auto flex items-center gap-1 px-2">
                <UButton
                    v-if="session?.user.username === user.username"
                    :to="$localePath('/settings/profile')"
                    :label="$t('user.editProfile')"
                    icon="mingcute:edit-3-fill"
                    variant="ghost"
                    size="sm"
                />
                <UButton
                    :label="$t('user.reportUser')"
                    icon="mingcute:flag-3-fill"
                    variant="ghost"
                    size="sm"
                    @click="session ? reportUser.open({ userId: user.username }) : login.open()"
                />
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

            <SetupsList type="owned" :username="user.username" />
        </div>
    </div>
</template>
