<script setup lang="ts">
const { t } = useI18n()

definePageMeta({
    middleware: defineNuxtRouteMiddleware(async () => {
        const localePath = useLocalePath()
        const { session } = useAuth()
        if (session.value) return navigateTo(localePath('/'))
    }),
})
useSeo({
    title: t('login'),
    description: t('modal.login.title'),
    image: '/ogp_2.png',
    twitterCard: 'summary_large_image',
})
</script>

<template>
    <div class="flex h-full w-full flex-col items-center justify-center gap-10">
        <UserLogin />
    </div>
</template>
