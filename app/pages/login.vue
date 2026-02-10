<script setup lang="ts">
const { signIn } = useAuth()
const { t } = useI18n()

definePageMeta({
    middleware: defineNuxtRouteMiddleware(async () => {
        const localePath = useLocalePath()
        const { session } = useAuth()
        if (session.value) return navigateTo(localePath('/'))
    }),
})
defineSeo({
    title: t('login'),
    description: t('modal.login.title'),
    image: 'https://avatio.me/ogp.png',
})
</script>

<template>
    <div class="flex h-full w-full flex-col items-center justify-center gap-10">
        <UCard variant="soft" class="w-full max-w-md">
            <template #header>
                <h1 class="text-lg font-bold">{{ $t('login') }}</h1>
            </template>

            <div class="flex flex-col gap-2">
                <UButton
                    loading-auto
                    :label="$t('loginPage.continueWith', { provider: 'X (Twitter)' })"
                    icon="mingcute:social-x-fill"
                    block
                    size="lg"
                    variant="subtle"
                    color="neutral"
                    @click="signIn.twitter()"
                />
            </div>

            <template #footer>
                <div class="flex items-center gap-3">
                    <UButton
                        :to="$localePath('/terms')"
                        :label="$t('modal.login.footer.terms')"
                        variant="link"
                        size="sm"
                        class="p-0"
                    />
                    <UButton
                        :to="$localePath('/privacy-policy')"
                        :label="$t('modal.login.footer.privacy')"
                        variant="link"
                        size="sm"
                        class="p-0"
                    />
                </div>
            </template>
        </UCard>
    </div>
</template>
