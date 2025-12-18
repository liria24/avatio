<script lang="ts" setup>
import { LazyModalProfileInitialize } from '#components'

const { $session } = useNuxtApp()
const session = await $session()
const route = useRoute()
const overlay = useOverlay()
const footerExclude = ['/setup/compose']
const needInitialize = session.value ? !session.value.user.isInitialized : false

overlay.create(LazyModalProfileInitialize, { defaultOpen: needInitialize })

const notificationsStore = useNotificationsStore()
if (session.value) await callOnce(notificationsStore.fetch)
const notifications = computed(() =>
    notificationsStore.notifications.filter(
        (notification) => !notification.readAt && notification.banner
    )
)
</script>

<template>
    <MotionConfig :transition="{ duration: 0.6 }" reduced-motion="user">
        <UContainer
            class="flex min-h-dvh flex-col items-center gap-6 pt-6 md:gap-8"
        >
            <Header />

            <div
                class="hidden w-full items-center justify-center rounded-xl bg-red-100 p-4 text-sm text-red-800 ring-2 ring-red-500 noscript:flex"
            >
                この Web サイトは JavaScript を使用しています。<br />
                JavaScript が無効の場合、正しく表示されません。
            </div>

            <div v-if="notifications.length" class="flex w-full flex-col gap-2">
                <BannerNotification
                    v-for="notification in notifications"
                    :key="notification.id"
                    :data="notification"
                    class="w-full"
                />
            </div>

            <main class="grid w-full grow">
                <slot />
            </main>

            <UButton
                v-if="
                    session &&
                    !['/login', '/setup/compose'].includes(route.path)
                "
                :to="$localePath('/setup/compose')"
                icon="lucide:plus"
                aria-label="セットアップを投稿"
                color="neutral"
                variant="solid"
                class="fixed right-4 bottom-4 rounded-full p-4 shadow-lg sm:hidden"
            />

            <Footer v-if="!footerExclude.includes(route.path)" />
        </UContainer>
    </MotionConfig>
</template>
