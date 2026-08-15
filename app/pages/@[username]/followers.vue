<script setup lang="ts">
const { session } = useAuth()
const username = useRouteParams('username', undefined, { transform: String })
const { t } = useI18n()

const { data } = await useUserFollowers(username.value)
const followers = ref(data.value?.followers ?? [])
const pagination = ref(data.value?.pagination)

const loadMore = async () => {
    if (!pagination.value?.hasNext) return

    const next = await $fetch(`/api/users/${username.value}/followers`, {
        query: {
            page: pagination.value.page + 1,
            limit: pagination.value.limit,
        },
    })

    followers.value = [...followers.value, ...next.followers]
    pagination.value = next.pagination
}

useSeo({
    title: data.value?.user.name
        ? t('user.follow.followersSeoTitle', { name: data.value.user.name })
        : undefined,
    image: data.value?.user.image || undefined,
})
</script>

<template>
    <NuxtLayout
        v-if="data"
        name="user-follows"
        :user="data.user"
        :tabs="{
            following: {
                to: $localePath(`/@${data.user.username}/following`),
                active: false,
            },
            followers: {
                to: $localePath(`/@${data.user.username}/followers`),
                active: true,
            },
        }"
    >
        <div class="flex flex-col gap-3">
            <span class="sentence mx-3 text-sm">
                {{
                    $t('user.follow.followersDescription', {
                        count: pagination?.total ?? followers.length,
                    })
                }}
            </span>

            <div class="grid gap-2 sm:grid-cols-2">
                <div
                    v-for="user in followers"
                    :key="user.username"
                    class="hover:bg-muted flex w-full items-center gap-0.5 rounded-xl pr-3"
                >
                    <NuxtLink :to="`/@${user.username}`" class="flex grow py-3 pr-1 pl-3">
                        <UUser
                            :avatar="{
                                src: user.image || undefined,
                                icon: 'mingcute:user-3-fill',
                            }"
                            :description="`@${user.username}`"
                            size="lg"
                            :ui="{
                                name: 'flex gap-1 items-center',
                                description: 'line-clamp-1 break-all wrap-anywhere font-mono',
                            }"
                        >
                            <template #name>
                                <span>{{ user.name }}</span>
                                <LazyUserBadges
                                    v-if="user.badges?.length"
                                    :badges="user.badges"
                                    size="sm"
                                />
                            </template>
                        </UUser>
                    </NuxtLink>

                    <LazyButtonUserFollow
                        v-if="session && session.user.username !== user.username"
                        :username="user.username"
                        :is-following="user.isFollowing"
                        size="sm"
                        class="px-4 py-1.5"
                    />
                </div>
            </div>

            <UButton
                v-if="pagination?.hasNext"
                :label="$t('more')"
                variant="ghost"
                color="neutral"
                class="self-center"
                loading-auto
                @click="loadMore"
            />
        </div>
    </NuxtLayout>
</template>
