<script setup lang="ts">
const { $login } = useNuxtApp()

const signingIn = ref(false)

const handleLogin = (provider: 'twitter') => {
    signingIn.value = true
    $login(provider)
}

definePageMeta({
    middleware: defineNuxtRouteMiddleware(async () => {
        const localePath = useLocalePath()
        const { $session } = useNuxtApp()
        const session = await $session()
        if (session.value) return navigateTo(localePath('/'))
    }),
})
defineSeo({
    title: 'ログイン',
    description: 'ユーザーアカウントにログインします。',
})
</script>

<template>
    <div class="flex h-full w-full flex-col items-center justify-center gap-10">
        <UCard variant="soft" class="w-full max-w-md">
            <template #header>
                <h1 class="text-lg font-bold">ログイン</h1>
            </template>

            <div class="flex flex-col gap-2">
                <UButton
                    :loading="signingIn"
                    label="X (Twitter) で続行"
                    icon="simple-icons:x"
                    block
                    size="lg"
                    variant="subtle"
                    color="neutral"
                    @click="handleLogin('twitter')"
                />
            </div>

            <template #footer>
                <div class="flex items-center gap-3">
                    <UButton
                        :to="$localePath('/terms')"
                        label="利用規約"
                        variant="link"
                        size="sm"
                        class="p-0"
                    />
                    <UButton
                        :to="$localePath('/privacy-policy')"
                        label="プライバシーポリシー"
                        variant="link"
                        size="sm"
                        class="p-0"
                    />
                </div>
            </template>
        </UCard>
    </div>
</template>
