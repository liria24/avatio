<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { LazyModalFeedback, LazyModalLogin } from '#components'

interface Props {
    session: Session
    sessions: Sessions
}
const props = defineProps<Props>()

const { $authClient, $revoke } = useNuxtApp()
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
            to: `/@${props.session.user.username}`,
            slot: 'user',
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
                ...props.sessions.map((session) => ({
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

        <template #user>
            <UUser
                :name="session.user.name"
                :description="`@${session.user.username}`"
                :avatar="{
                    src: session.user.image || undefined,
                    alt: session.user.name,
                    icon: 'lucide:user-round',
                }"
            />
        </template>
    </UDropdownMenu>
</template>
