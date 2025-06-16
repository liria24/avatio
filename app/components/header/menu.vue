<script lang="ts" setup>
import type { DropdownMenuItem } from '@nuxt/ui'

const route = useRoute()
const user = useSupabaseUser()
const client = useSupabaseClient<Database>()

const menuItems = ref<DropdownMenuItem[][]>([
    [
        {
            label: 'プロフィール',
            icon: 'lucide:user-round',
            onSelect: () => {
                if (user.value) navigateTo(`/@${user.value.id}`)
                else navigateTo('/login')
            },
        },
        {
            label: '設定',
            icon: 'lucide:bolt',
            onSelect: () => navigateTo('/settings'),
        },
    ],
    [
        {
            label: 'ログアウト',
            icon: 'lucide:log-out',
            onSelect: () => useSignOut(),
        },
    ],
])

const userRefresh = async () => {
    if (!user.value) return (userProfile.value.avatar = null)

    try {
        const { data } = await client
            .from('users')
            .select('id, name, avatar, badges:user_badges(name, created_at)')
            .eq('id', user.value.id)
            .maybeSingle()

        userProfile.value.id = data?.id ?? null
        userProfile.value.name = data?.name ?? null
        userProfile.value.avatar = data?.avatar ?? null
        userProfile.value.badges = data?.badges ?? []
    } catch {
        userProfile.value.id = null
        userProfile.value.name = null
        userProfile.value.avatar = null
        userProfile.value.badges = []
    }
}

watchEffect(async () => await userRefresh())

onMounted(async () => {
    if (user.value) await userRefresh()
})
</script>

<template>
    <div class="flex items-center gap-2">
        <div class="flex items-center gap-1">
            <UButton
                v-if="
                    user && !['/login', '/setup/compose'].includes(route.path)
                "
                to="/setup/compose"
                icon="lucide:plus"
                color="neutral"
                class="md:rounded-full md:py-3 md:pr-6 md:pl-5"
            >
                <!-- <Icon name="lucide:plus" size="20" /> -->
                <span class="hidden whitespace-nowrap md:inline">
                    セットアップを投稿
                </span>
            </UButton>

            <UTooltip
                v-if="route.path !== '/login'"
                text="検索"
                :delay-duration="0"
            >
                <UButton
                    to="/search"
                    aria-label="検索"
                    icon="lucide:search"
                    variant="ghost"
                />
            </UTooltip>

            <UTooltip
                v-if="user && route.path !== '/login'"
                text="ブックマーク"
                :delay-duration="0"
            >
                <UButton
                    to="/bookmarks"
                    icon="lucide:bookmark"
                    aria-label="ブックマーク"
                    variant="ghost"
                />
            </UTooltip>

            <ButtonTheme />
        </div>

        <template v-if="route.path !== '/login'">
            <ClientOnly>
                <UDropdownMenu v-if="user" :items="menuItems">
                    <UAvatar
                        :src="
                            getImage(userProfile.avatar, {
                                prefix: 'avatar',
                            })
                        "
                        :alt="userProfile.name ?? ''"
                        class="hidden size-8 cursor-pointer outline-0 outline-zinc-300 transition-all select-none hover:outline-4 sm:block dark:outline-zinc-600"
                    />
                </UDropdownMenu>

                <UButton
                    v-else
                    id="login"
                    to="/login"
                    label="ログイン"
                    variant="solid"
                    size="lg"
                    class="hidden sm:block"
                />
            </ClientOnly>
        </template>
    </div>
</template>
