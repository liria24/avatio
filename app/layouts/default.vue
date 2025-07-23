<script lang="ts" setup>
const nuxtApp = useNuxtApp()
const session = await nuxtApp.$session()
const route = useRoute()
const footerExclude = ['/setup/compose']

const isInitialized = await (async () => {
    if (session.value) {
        try {
            const { result } = await $fetch<{ result: boolean }>(
                '/api/users/is-initialized',
                {
                    headers: (() => {
                        if (
                            import.meta.server &&
                            nuxtApp.ssrContext?.event.headers
                        )
                            return nuxtApp.ssrContext.event.headers
                    })(),
                }
            )
            return result
        } catch (error) {
            console.error('Error checking initialization:', error)
            return true
        }
    }
    return true
})()

const modalLogin = ref(false)
const modalFeedback = ref(false)
const modalInitialize = ref(!isInitialized)

const notificationsStore = useNotificationsStore()
if (session.value) await callOnce(notificationsStore.fetch)
const notifications = computed(() =>
    notificationsStore.notifications.filter(
        (notification) => !notification.readAt && notification.banner
    )
)
</script>

<template>
    <Html>
        <Head>
            <Title>Avatio</Title>
            <Link rel="icon" type="image/svg+xml" href="/favicon.svg" />
            <Meta name="lang" content="ja" />
        </Head>
        <Body>
            <UContainer
                class="flex min-h-dvh flex-col items-center gap-6 pt-6 md:gap-8"
            >
                <LazyModalLogin v-model:open="modalLogin" />
                <LazyModalFeedback v-model:open="modalFeedback" />

                <ModalProfileInitialize
                    v-if="!isInitialized"
                    v-model:open="modalInitialize"
                />

                <Header
                    @open-login-modal="modalLogin = true"
                    @open-feedback-modal="modalFeedback = true"
                />

                <div
                    class="hidden w-full items-center justify-center rounded-xl bg-red-100 p-4 text-sm text-red-800 ring-2 ring-red-500 noscript:flex"
                >
                    この Web サイトは JavaScript を使用しています。<br />
                    JavaScript が無効の場合、正しく表示されません。
                </div>

                <div
                    v-if="notifications.length"
                    class="flex w-full flex-col gap-2"
                >
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

                <Footer
                    v-if="!footerExclude.includes(route.path)"
                    @open-feedback-modal="modalFeedback = true"
                />
            </UContainer>
        </Body>
    </Html>
</template>
