<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { LazyModalFeedback, LazyModalLogin } from '#components'

interface Props {
    session: Session
    sessions?: Sessions
}
const props = defineProps<Props>()

const { auth, revoke } = useAuth()
const route = useRoute()
const toast = useToast()
const colorMode = useColorMode()
const overlay = useOverlay()

const modalLogin = overlay.create(LazyModalLogin)
const modalFeedback = overlay.create(LazyModalFeedback)

const switchAccount = async (sessionToken: string) => {
    await auth.multiSession.setActive({ sessionToken })
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
        icon: 'mingcute:monitor-fill',
        onSelect: () => {
            colorMode.preference = 'system'
        },
    },
    {
        label: 'ライト',
        icon: 'mingcute:sun-fill',
        onSelect: () => {
            colorMode.preference = 'light'
        },
    },
    {
        label: 'ダーク',
        icon: 'mingcute:moon-fill',
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
            icon: 'mingcute:bookmark-fill',
            to: `/bookmarks`,
        },
        {
            label: '設定',
            icon: 'mingcute:settings-1-fill',
            to: '/settings',
        },
    ],
    [
        {
            label: 'フィードバック',
            icon: 'mingcute:chat-3-fill',
            onSelect: () => modalFeedback.open(),
        },
        {
            label: 'テーマ',
            icon: 'mingcute:moon-fill',
            children: themeMenu,
        },
    ],
    [
        {
            label: 'アカウント切替',
            icon: 'mingcute:group-2-fill',
            children: [
                ...(props.sessions?.map((session) => ({
                    label: session.user.name,
                    avatar: {
                        src: session.user.image || undefined,
                        alt: session.user.name,
                        icon: 'mingcute:user-3-fill',
                    },
                    onSelect: () => switchAccount(session.session.token),
                })) || []),
                {
                    label: '新しいアカウント',
                    icon: 'mingcute:user-add-2-fill',
                    onSelect: () => modalLogin.open(),
                },
            ],
        },
        {
            label: 'ログアウト',
            icon: 'mingcute:open-door-fill',
            onSelect: revoke,
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
                icon="mingcute:user-3-fill"
            />
        </button>

        <template #user>
            <UUser
                :name="session.user.name"
                :description="`@${session.user.username}`"
                :avatar="{
                    src: session.user.image || undefined,
                    alt: session.user.name,
                    icon: 'mingcute:user-3-fill',
                }"
            />
        </template>
    </UDropdownMenu>
</template>
