<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

const emit = defineEmits(['openFeedbackModal'])

const { $logout } = useNuxtApp()
const route = useRoute()
const colorMode = useColorMode()
const session = await useGetSession()

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
            label: 'フィードバック',
            icon: 'lucide:message-square',
            onSelect: () => emit('openFeedbackModal'),
        },
        {
            label: 'ログアウト',
            icon: 'lucide:log-out',
            onSelect: $logout,
        },
    ],
])
</script>

<template>
    <header class="flex w-full items-center justify-between gap-6">
        <div class="flex items-center gap-3">
            <NuxtLinkLocale to="/">
                <LogoAvatio class="w-24 sm:w-32" aria-label="Avatio" />
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

        <UButton
            v-if="!['/login', '/setup/compose'].includes(route.path)"
            :to="$localePath('/search')"
            icon="lucide:search"
            label="セットアップを検索"
            variant="ghost"
            class="text-dimmed"
        />

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
                    variant="soft"
                    class="hidden rounded-full py-2 pr-6 pl-5 md:flex"
                >
                    <span class="hidden whitespace-nowrap md:inline">
                        セットアップを投稿
                    </span>
                </UButton>

                <ClientOnly v-if="!session">
                    <UDropdownMenu
                        :items="themeMenu"
                        :content="{
                            align: 'center',
                            side: 'bottom',
                            sideOffset: 8,
                        }"
                    >
                        <UTooltip text="テーマ" :delay-duration="0">
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
                <UDropdownMenu v-if="session" :items="menuItems">
                    <UAvatar
                        :src="session.user.image || undefined"
                        :alt="session.user.name"
                        class="ring-accented size-8 cursor-pointer ring-0 transition-all select-none hover:ring-4"
                    />
                </UDropdownMenu>

                <ModalLogin v-else-if="!session && route.path !== '/login'">
                    <UButton label="ログイン" variant="solid" size="lg" />
                </ModalLogin>
            </template>
        </div>
    </header>
</template>
