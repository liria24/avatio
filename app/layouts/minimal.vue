<script lang="ts" setup>
const { session } = await useAuth()
const route = useRoute()
const { login } = useAppOverlay()
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
                            <HeaderMenu />
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

            <main class="grid w-full grow">
                <slot />
            </main>
        </UContainer>
    </MotionConfig>
</template>
