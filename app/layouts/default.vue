<script lang="ts" setup>
const { session, sessions } = useAuth()
const route = useRoute()
const { login } = useAppOverlay()

const { notifications } = useNotifications()
const filteredNotifications = computed(() => notifications.value.filter((n) => n.banner))
</script>

<template>
    <MotionConfig :transition="{ duration: 0.6 }" reduced-motion="user">
        <UContainer class="flex min-h-dvh flex-col items-center gap-6 pt-6 md:gap-8">
            <header class="flex w-full items-center justify-between gap-6">
                <HeaderLeft />

                <div class="flex items-center gap-1.5">
                    <div class="flex items-center gap-1">
                        <UButton
                            v-if="session"
                            :to="$localePath('/setup/compose')"
                            icon="mingcute:add-line"
                            :label="$t('header.postSetup')"
                            color="neutral"
                            variant="soft"
                            class="mr-1 hidden rounded-full py-2 pr-6 pl-5 sm:flex"
                        />

                        <UTooltip :text="$t('header.searchSetup')" :delay-duration="50">
                            <UButton
                                :to="$localePath('/search')"
                                :aria-label="$t('header.searchSetup')"
                                icon="mingcute:search-line"
                                variant="ghost"
                            />
                        </UTooltip>

                        <HeaderThemeButton v-if="!session" />
                        <HeaderLanguageButton v-if="!session" />
                    </div>

                    <template v-if="route.path !== '/login'">
                        <div v-if="session" class="flex items-center gap-2">
                            <HeaderNotificationButton />
                            <HeaderMenu :session :sessions />
                        </div>

                        <UButton
                            v-else
                            :label="$t('login')"
                            variant="outline"
                            class="rounded-lg px-4 py-2 text-xs"
                            @click="login.open()"
                        />
                    </template>
                </div>
            </header>

            <div v-if="filteredNotifications.length" class="flex w-full flex-col gap-2">
                <BannerNotification
                    v-for="notification in filteredNotifications"
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
                icon="mingcute:add-line"
                :aria-label="$t('header.postSetup')"
                color="neutral"
                variant="solid"
                class="fixed right-4 bottom-4 rounded-full p-4 shadow-lg sm:hidden"
            />

            <AppFooter />
        </UContainer>
    </MotionConfig>
</template>
