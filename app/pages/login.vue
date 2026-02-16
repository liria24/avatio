<script setup lang="ts">
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
        <UserLogin />
    </div>
</template>
