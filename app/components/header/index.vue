<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

const emit = defineEmits<{
    (e: 'openFeedbackModal' | 'openLoginModal'): void
}>()

const { $authClient, $session, $multiSession, $revoke } = useNuxtApp()
const session = await $session()
const sessions = await $multiSession()
const route = useRoute()
const toast = useToast()
const colorMode = useColorMode()

const switchAccount = async (sessionToken: string) => {
    await $authClient.multiSession.setActive({ sessionToken })
    toast.add({
        title: 'アカウントを切り替えました',
        description: 'ページを更新しています...',
        progress: false,
    })
    navigateTo(route.path, { external: true })
}

const themeMenu = [
    {
        label: 'システム',
        icon: 'lucide:monitor',
        onSelect: () => {
            colorMode.preference = 'system'
        },
    },
    {
        label: 'ライト',
        icon: 'lucide:sun',
        onSelect: () => {
            colorMode.preference = 'light'
        },
    },
    {
        label: 'ダーク',
        icon: 'lucide:moon',
        onSelect: () => {
            colorMode.preference = 'dark'
        },
    },
]

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
            label: 'ブックマーク',
            icon: 'lucide:bookmark',
            onSelect: () => {
                if (session.value) navigateTo(`/bookmarks`)
                else navigateTo('/login')
            },
        },
    ],
    [
        {
            label: 'フィードバック',
            icon: 'lucide:message-square',
            onSelect: () => emit('openFeedbackModal'),
        },
        {
            label: 'テーマ',
            icon: 'lucide:moon',
            children: themeMenu,
        },
        {
            label: '設定',
            icon: 'lucide:bolt',
            onSelect: () => navigateTo('/settings'),
        },
    ],
    [
        {
            label: 'アカウント切替',
            icon: 'lucide:users-round',
            children: [
                ...sessions.map((session) => ({
                    label: session.user.name,
                    avatar: {
                        src: session.user.image || undefined,
                        alt: session.user.name,
                    },
                    onSelect: () => switchAccount(session.session.token),
                })),
                {
                    label: '新しいアカウント',
                    icon: 'lucide:user-round-plus',
                    onSelect: () => emit('openLoginModal'),
                },
            ],
        },
        {
            label: 'ログアウト',
            icon: 'lucide:log-out',
            onSelect: $revoke,
        },
    ],
])
</script>

<template>
    <header class="flex w-full items-center justify-between gap-6">
        <div class="flex items-center gap-3">
            <NuxtLinkLocale to="/">
                <LogoAvatio class="w-24 sm:w-28" aria-label="Avatio" />
            </NuxtLinkLocale>

            <UButton
                v-if="session?.user.role === 'admin'"
                :to="$localePath('/admin')"
                label="admin"
                variant="subtle"
                size="xs"
                class="font-[Geist]"
            />
        </div>

        <div class="flex items-center gap-1">
            <div class="flex items-center gap-1">
                <UButton
                    v-if="
                        session &&
                        !['/login', '/setup/compose'].includes(route.path)
                    "
                    :to="$localePath('/setup/compose')"
                    icon="lucide:plus"
                    label="セットアップを投稿"
                    color="neutral"
                    variant="soft"
                    class="mr-1 hidden rounded-full py-2 pr-6 pl-5 sm:flex"
                />

                <UTooltip
                    v-if="!['/login', '/setup/compose'].includes(route.path)"
                    text="セットアップを検索"
                    :delay-duration="50"
                >
                    <UButton
                        :to="$localePath('/search')"
                        aria-label="セットアップを検索"
                        icon="lucide:search"
                        variant="ghost"
                    />
                </UTooltip>

                <ClientOnly v-if="!session">
                    <UDropdownMenu
                        :items="themeMenu"
                        :content="{
                            align: 'center',
                            side: 'bottom',
                            sideOffset: 8,
                        }"
                    >
                        <UTooltip text="テーマ" :delay-duration="50">
                            <UButton
                                :icon="
                                    colorMode.value === 'dark'
                                        ? 'lucide:moon'
                                        : 'lucide:sun'
                                "
                                aria-label="テーマ"
                                variant="ghost"
                            />
                        </UTooltip>
                    </UDropdownMenu>

                    <template #fallback>
                        <UButton
                            icon="lucide:palette"
                            aria-label="テーマ"
                            variant="ghost"
                        />
                    </template>
                </ClientOnly>
            </div>

            <template v-if="route.path !== '/login'">
                <div v-if="session" class="flex items-center gap-2">
                    <PopoverNotifications v-slot="{ unread }">
                        <UTooltip text="通知" :delay-duration="50">
                            <UChip :show="!!unread" color="neutral" inset>
                                <UButton icon="lucide:bell" variant="ghost" />
                            </UChip>
                        </UTooltip>
                    </PopoverNotifications>

                    <UDropdownMenu :items="menuItems">
                        <UAvatar
                            :src="session.user.image || undefined"
                            :alt="session.user.name"
                            icon="lucide:user-round"
                            class="ring-accented size-8 cursor-pointer ring-0 transition-all select-none hover:ring-4"
                        />
                    </UDropdownMenu>
                </div>

                <UButton
                    v-else-if="!session && route.path !== '/login'"
                    label="ログイン"
                    variant="outline"
                    class="rounded-lg px-4 py-2 text-xs"
                    @click="emit('openLoginModal')"
                />
            </template>
        </div>
    </header>
</template>
