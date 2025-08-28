<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { LazyModalFeedback, LazyModalLogin } from '#components'

const { $authClient, $session, $multiSession, $revoke } = useNuxtApp()
const session = await $session()
const sessions = await $multiSession()
const route = useRoute()
const toast = useToast()
const colorMode = useColorMode()
const overlay = useOverlay()

const modalLogin = overlay.create(LazyModalLogin)
const modalFeedback = overlay.create(LazyModalFeedback)

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
            to: `/@${session.value?.user.id}`,
            label: session.value?.user.name,
            avatar: {
                src: session.value?.user.image || undefined,
                icon: 'lucide:user-round',
            },
        },
    ],
    [
        {
            label: 'ブックマーク',
            icon: 'lucide:bookmark',
            to: `/bookmarks`,
        },
        {
            label: '設定',
            icon: 'lucide:bolt',
            to: '/settings',
        },
    ],
    [
        {
            label: 'フィードバック',
            icon: 'lucide:message-square',
            onSelect: () => modalFeedback.open(),
        },
        {
            label: 'テーマ',
            icon: 'lucide:moon',
            children: themeMenu,
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
                        icon: 'lucide:user-round',
                    },
                    onSelect: () => switchAccount(session.session.token),
                })),
                {
                    label: '新しいアカウント',
                    icon: 'lucide:user-round-plus',
                    onSelect: () => modalLogin.open(),
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
                        <button
                            type="button"
                            class="ring-accented size-8 cursor-pointer rounded-full ring-0 transition-all select-none hover:ring-4"
                        >
                            <UAvatar
                                :src="session.user.image || undefined"
                                :alt="session.user.name"
                                icon="lucide:user-round"
                            />
                        </button>
                    </UDropdownMenu>
                </div>

                <UButton
                    v-else-if="!session && route.path !== '/login'"
                    label="ログイン"
                    variant="outline"
                    class="rounded-lg px-4 py-2 text-xs"
                    @click="modalLogin.open()"
                />
            </template>
        </div>
    </header>
</template>
