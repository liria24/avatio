<script setup lang="ts">
const route = useRoute()
const { session } = useAuth()

const { data } = await useUserFollowees(route.params.username as string)

useSeo({
    title: `${data.value?.user.name}さんのフォロー`,
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
                active: true,
            },
            followers: {
                to: $localePath(`/@${data.user.username}/followers`),
                active: false,
            },
        }"
    >
        <div class="grid gap-2 sm:grid-cols-2">
            <div
                v-for="user in data.followees"
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
    </NuxtLayout>
</template>
