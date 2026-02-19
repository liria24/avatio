<script lang="ts" setup>
interface Props {
    user: Serialized<User>
}
const { user } = defineProps<Props>()

const emit = defineEmits(['click'])

const { session } = useAuth()
</script>

<template>
    <UPopover mode="hover" :ui="{ content: 'flex items-center gap-0.5 px-2' }">
        <slot />

        <template #content>
            <NuxtLink :to="`/@${user.username}`" class="flex max-w-48 py-2 pr-1">
                <UUser
                    :avatar="{
                        src: user.image || undefined,
                        icon: 'mingcute:user-3-fill',
                    }"
                    :description="`@${user.username}`"
                    :ui="{
                        name: 'flex gap-1 items-center',
                        description: 'line-clamp-1 break-all wrap-anywhere font-mono',
                    }"
                >
                    <template #name>
                        <span>{{ user.name }}</span>
                        <UserBadges v-if="user.badges?.length" :badges="user.badges" size="sm" />
                    </template>
                </UUser>
            </NuxtLink>

            <ButtonUserFollow
                v-if="session?.user.username !== user.username"
                :username="user.username"
                size="sm"
                class="px-3 py-1.5"
            />
        </template>
    </UPopover>
</template>
