<script setup lang="ts">
interface Props {
    session: Session
    sessions?: Sessions
}
const props = defineProps<Props>()

const { auth, revoke } = useAuth()
const route = useRoute()
const toast = useToast()
const colorMode = useColorMode()
const { login, feedback } = useAppOverlay()
const { t, locales, setLocale } = useI18n()

const switchAccount = async (sessionToken: string) => {
    await auth.multiSession.setActive({ sessionToken })
    toast.add({
        title: t('header.menu.switchAccount'),
        description: t('loading'),
        progress: false,
    })
    navigateTo(route.path, { external: true })
}
</script>

<template>
    <UDropdownMenu
        :items="[
            [
                {
                    to: $localePath(`/@${props.session.user.username}`),
                    slot: 'user',
                },
            ],
            [
                {
                    label: t('header.menu.bookmarks'),
                    icon: 'mingcute:bookmark-fill',
                    to: $localePath('/bookmarks'),
                },
                {
                    label: t('header.menu.settings'),
                    icon: 'mingcute:settings-1-fill',
                    to: $localePath('/settings'),
                },
            ],
            [
                {
                    label: t('header.menu.feedback'),
                    icon: 'mingcute:chat-3-fill',
                    onSelect: () => feedback.open(),
                },
                {
                    label: t('theme'),
                    icon: 'mingcute:moon-fill',
                    children: [
                        {
                            label: t('system'),
                            icon: 'mingcute:monitor-fill',
                            onSelect: () => {
                                colorMode.preference = 'system'
                            },
                        },
                        {
                            label: t('light'),
                            icon: 'mingcute:sun-fill',
                            onSelect: () => {
                                colorMode.preference = 'light'
                            },
                        },
                        {
                            label: t('dark'),
                            icon: 'mingcute:moon-fill',
                            onSelect: () => {
                                colorMode.preference = 'dark'
                            },
                        },
                    ],
                },
                {
                    label: t('language'),
                    icon: 'mingcute:translate-2-line',
                    children: locales.map((locale) => ({
                        label: locale.name,
                        icon: locale.icon,
                        onSelect: () => {
                            setLocale(locale.code)
                        },
                    })),
                },
            ],
            [
                {
                    label: t('header.menu.switchAccount'),
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
                            label: t('header.menu.newAccount'),
                            icon: 'mingcute:user-add-2-fill',
                            onSelect: () => login.open(),
                        },
                    ],
                },
                {
                    label: t('header.menu.logout'),
                    icon: 'mingcute:open-door-fill',
                    onSelect: revoke,
                },
            ],
        ]"
    >
        <button
            type="button"
            :aria-label="$t('header.userMenu')"
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
                :ui="{ description: 'font-mono max-w-32 break-all line-clamp-1' }"
            />
        </template>
    </UDropdownMenu>
</template>
