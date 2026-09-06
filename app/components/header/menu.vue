<script setup lang="ts">
const { user, loggedIn, signOut, fetchSession } = useUserSession()
const { data: sessions, load: loadSessions, setActive } = useDeviceSessions()
const toast = useToast()
const colorMode = useColorMode()
const login = useLoginModal()
const feedback = useFeedbackModal()
const { t, locales, setLocale } = useI18n()
const open = ref(false)

watch(open, async (value) => {
    if (value && loggedIn.value && sessions.value === undefined) await loadSessions()
})

const switchAccount = async (sessionToken: string) => {
    await setActive(sessionToken)
    await fetchSession({ force: true })
    toast.add({
        id: 'switching-account',
        icon: 'svg-spinners:ring-resize',
        title: t('header.menu.switchAccount'),
        description: t('loading'),
        progress: false,
    })
    reloadNuxtApp()
}

const revoke = () => signOut({ onSuccess: () => reloadNuxtApp() })
</script>

<template>
    <UDropdownMenu
        v-model:open="open"
        :items="[
            [
                {
                    to: $localePath(`/@${user?.username}`),
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
                        ...(sessions?.map((s) => ({
                            label: s.user.name,
                            avatar: {
                                src: s.user.image || undefined,
                                alt: s.user.name,
                                icon: 'mingcute:user-3-fill',
                            },
                            onSelect: () => switchAccount(s.session.token),
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
                :src="user?.image || undefined"
                :alt="user?.name"
                icon="mingcute:user-3-fill"
            />
        </button>

        <template #user>
            <UUser
                :name="user?.name"
                :description="`@${user?.username}`"
                :avatar="{
                    src: user?.image || undefined,
                    alt: user?.name,
                    icon: 'mingcute:user-3-fill',
                }"
                :ui="{ description: 'font-mono max-w-32 break-all line-clamp-1' }"
            />
        </template>
    </UDropdownMenu>
</template>
