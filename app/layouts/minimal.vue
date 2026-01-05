<script lang="ts" setup>
import { LazyModalLogin } from '#components'

const { getSession, getSessions } = useAuth()
const session = await getSession()
const sessions = await getSessions()
const route = useRoute()
const overlay = useOverlay()

const modalLogin = overlay.create(LazyModalLogin)
</script>

<template>
    <MotionConfig :transition="{ duration: 0.6 }" reduced-motion="user">
        <UContainer class="flex min-h-dvh flex-col items-center gap-6 pt-6 md:gap-8">
            <header class="flex w-full items-center justify-between gap-6">
                <HeaderLeft />

                <div class="flex items-center gap-1">
                    <HeaderThemeButton v-if="!session" />

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

            <main class="grid w-full grow">
                <slot />
            </main>
        </UContainer>
    </MotionConfig>
</template>
