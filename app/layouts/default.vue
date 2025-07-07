<script lang="ts" setup>
const route = useRoute()
const footerExclude = ['/setup/compose']

const modalFeedback = ref(false)

const notificationsStore = useNotificationsStore()
await callOnce(notificationsStore.fetch)
const notifications = computed(() =>
    notificationsStore.notifications.filter((notification) => {
        return !notification.readAt && notification.banner
    })
)
</script>

<template>
    <Html lang="ja">
        <Head>
            <Title>Avatio</Title>
            <Link rel="icon" type="image/svg+xml" href="/favicon.svg" />
            <Meta name="lang" content="ja" />
        </Head>
        <Body>
            <UContainer
                class="flex min-h-dvh flex-col items-center gap-6 pt-6 md:gap-8"
            >
                <ModalFeedback v-model:open="modalFeedback" />

                <Header @open-feedback-modal="modalFeedback = true" />

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

                <Footer
                    v-if="!footerExclude.includes(route.path)"
                    @open-feedback-modal="modalFeedback = true"
                />
            </UContainer>
        </Body>
    </Html>
</template>
