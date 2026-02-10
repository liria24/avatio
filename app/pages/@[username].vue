<script lang="ts" setup>
const { session } = useAuth()
const { locale } = useI18n()
const route = useRoute()
const { login, reportUser } = useAppOverlay()

const username = route.params.username as string

const { data: user, status: userStatus } = await useUser(username)

if (userStatus.value === 'success' && !user.value)
    showError({
        status: 404,
        statusText: 'IDが無効です',
    })

const links = computed(() =>
    user.value?.links?.map((link) => {
        const attributes = useLinkAttributes(link)
        return {
            label: attributes.label,
            icon: attributes.icon,
            to: link,
        }
    })
)

onBeforeRouteLeave(() => {
    login.close()
    reportUser.close()
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
            <div
                class="flex w-full flex-col items-start justify-between gap-3 sm:flex-row sm:items-center"
            >
                <div class="flex items-center gap-6">
                    <NuxtImg
                        v-if="user.image"
                        v-slot="{ isLoaded, src, imgAttrs }"
                        :src="user.image"
                        :width="88"
                        :height="88"
                        format="avif"
                        preload
                        custom
                    >
                        <img
                            v-if="isLoaded"
                            v-bind="imgAttrs"
                            :src
                            alt=""
                            class="aspect-square size-14 shrink-0 rounded-full object-cover sm:size-20"
                        />
                        <USkeleton
                            v-else
                            class="aspect-square size-14 shrink-0 rounded-full sm:size-20"
                        />
                    </NuxtImg>

                    <div
                        v-else
                        class="bg-muted flex size-14 shrink-0 items-center justify-center rounded-full md:size-20"
                    >
                        <Icon name="mingcute:user-3-fill" size="32" class="text-muted" />
                    </div>

                    <div class="flex flex-col gap-1">
                        <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <p class="text-2xl font-bold">
                                {{ user.name }}
                            </p>
                            <UserBadges v-if="user.badges" :badges="user.badges" />
                        </div>

                        <div class="text-muted flex items-center gap-1 font-mono text-sm">
                            <span> @{{ user.username }} </span>

                            <Icon name="mingcute:calendar-2-fill" size="18" class="ml-2" />
                            <NuxtTime :datetime="user.createdAt" date-style="short" :locale />
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-1 self-end sm:self-auto">
                    <UButton
                        v-if="session?.user.username === user.username"
                        :to="$localePath('/settings')"
                        :label="$t('user.editProfile')"
                        icon="mingcute:edit-3-fill"
                        variant="ghost"
                        size="sm"
                        class="self-end"
                    />

                    <UButton
                        :label="$t('user.reportUser')"
                        icon="mingcute:flag-3-fill"
                        variant="ghost"
                        size="sm"
                        class="self-end"
                        @click="session ? reportUser.open({ userId: user.username }) : login.open()"
                    />
                </div>
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
                        :alt="shop.shop.name"
                        :width="32"
                        :height="32"
                        format="webp"
                        fit="cover"
                        loading="lazy"
                        fetchpriority="low"
                        custom
                        class="aspect-square size-8 shrink-0 rounded-lg object-cover"
                    >
                        <img v-if="isLoaded" v-bind="imgAttrs" :src="src" />
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
