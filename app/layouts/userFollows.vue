<script setup lang="ts">
interface Props {
    user: Serialized<User>
    tabs: {
        following: {
            to: string
            active: boolean
        }
        followers: {
            to: string
            active: boolean
        }
    }
}
const { user, tabs } = defineProps<Props>()
</script>

<template>
    <div class="flex flex-col gap-6">
        <div class="flex items-center gap-3">
            <NuxtImg
                v-if="user.image"
                :src="user.image"
                alt=""
                :width="88"
                :height="88"
                format="avif"
                preload
                class="aspect-square size-14 shrink-0 rounded-full object-cover sm:size-18"
            />

            <div
                v-else
                class="bg-muted flex size-14 shrink-0 items-center justify-center rounded-full md:size-18"
            >
                <Icon name="mingcute:user-3-fill" size="32" class="text-muted" />
            </div>

            <div class="flex flex-col gap-1">
                <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h2 class="text-2xl font-bold">
                        {{ user.name }}
                    </h2>
                    <UserBadges v-if="user.badges" :badges="user.badges" />
                </div>

                <span class="text-muted flex items-center gap-1 font-mono text-sm">
                    @{{ user.username }}
                </span>
            </div>
        </div>

        <div class="flex flex-wrap items-center gap-1">
            <UButton
                :to="tabs.following.to"
                label="フォロー中"
                :active="tabs.following.active"
                variant="ghost"
                active-variant="solid"
                color="neutral"
                class="px-4 py-2"
            />
            <UButton
                :to="tabs.followers.to"
                label="フォロワー"
                :active="tabs.followers.active"
                variant="ghost"
                active-variant="solid"
                color="neutral"
                class="px-4 py-2"
            />
        </div>

        <USeparator />

        <slot />
    </div>
</template>
