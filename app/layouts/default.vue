<script lang="ts" setup>
import { LazyModalLogin } from '#components'

const { $session, $multiSession } = useNuxtApp()
const session = await $session()
const sessions = await $multiSession()
const route = useRoute()
const overlay = useOverlay()

const modalLogin = overlay.create(LazyModalLogin)

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
        <UContainer class="flex min-h-dvh flex-col items-center gap-6 pt-6 md:gap-8">
            <header class="flex w-full items-center justify-between gap-6">
                <HeaderLeft />

                <div class="flex items-center gap-1">
                    <div class="flex items-center gap-1">
                        <UButton
                            v-if="session"
                            :to="$localePath('/setup/compose')"
                            icon="lucide:plus"
                            label="セットアップを投稿"
                            color="neutral"
                            variant="soft"
                            class="mr-1 hidden rounded-full py-2 pr-6 pl-5 sm:flex"
                        />

                        <UTooltip text="セットアップを検索" :delay-duration="50">
                            <UButton
                                :to="$localePath('/search')"
                                aria-label="セットアップを検索"
                                icon="lucide:search"
                                variant="ghost"
                            />
                        </UTooltip>

                        <HeaderThemeButton v-if="!session" />
                    </div>

                    <template v-if="route.path !== '/login'">
                        <div v-if="session" class="flex items-center gap-2">
                            <HeaderNotificationButton />
                            <HeaderMenu :session :sessions />
                        </div>

                        <UButton
                            v-else
                            label="ログイン"
                            variant="outline"
                            class="rounded-lg px-4 py-2 text-xs"
                            @click="modalLogin.open()"
                        />
                    </template>
                </div>
            </header>

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
                v-if="session"
                :to="$localePath('/setup/compose')"
                icon="lucide:plus"
                aria-label="セットアップを投稿"
                color="neutral"
                variant="solid"
                class="fixed right-4 bottom-4 rounded-full p-4 shadow-lg sm:hidden"
            />

            <Footer />
        </UContainer>
    </MotionConfig>
</template>
