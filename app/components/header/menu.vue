<script lang="ts" setup>
import type { DropdownMenuItem } from '@nuxt/ui'

const localePath = useLocalePath()
const route = useRoute()
const session = await useGetSession()

const menuItems = ref<DropdownMenuItem[][]>([
    [
        {
            label: 'プロフィール',
            icon: 'lucide:user-round',
            onSelect: () => {
                if (session.value) navigateTo(`/@${session.value.user.id}`)
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
            onSelect: async () => {
                const result = await authClient.signOut()
                if (result.data?.success) navigateTo(localePath('/'))
            },
        },
    ],
])
</script>

<template>
    <div class="flex items-center gap-2">
        <div class="flex items-center gap-1">
            <UButton
                v-if="
                    session &&
                    !['/login', '/setup/compose'].includes(route.path)
                "
                :to="$localePath('/setup/compose')"
                icon="lucide:plus"
                color="neutral"
                class="md:rounded-full md:py-3 md:pr-6 md:pl-5"
            >
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
                    :to="$localePath('/search')"
                    aria-label="検索"
                    icon="lucide:search"
                    variant="ghost"
                />
            </UTooltip>

            <UTooltip
                v-if="session && route.path !== '/login'"
                text="ブックマーク"
                :delay-duration="0"
            >
                <UButton
                    :to="$localePath('/bookmarks')"
                    icon="lucide:bookmark"
                    aria-label="ブックマーク"
                    variant="ghost"
                />
            </UTooltip>

            <HeaderThemeButton />
        </div>

        <template v-if="route.path !== '/login'">
            <ClientOnly>
                <UDropdownMenu v-if="session" :items="menuItems">
                    <UAvatar
                        :src="session.user.image"
                        :alt="session.user.name"
                        class="hidden size-8 cursor-pointer outline-0 outline-zinc-300 transition-all select-none hover:outline-4 sm:block dark:outline-zinc-600"
                    />
                </UDropdownMenu>

                <ModalLogin v-else-if="!session && route.path !== '/login'">
                    <UButton
                        label="ログイン"
                        variant="solid"
                        size="lg"
                        class="hidden sm:block"
                    />
                </ModalLogin>

                <template #fallback>
                    <USkeleton class="h-8 w-8 rounded-full" />
                </template>
            </ClientOnly>
        </template>
    </div>
</template>
