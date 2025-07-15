<script setup lang="ts">
import * as locales from '@nuxt/ui/locale'
import { Analytics } from '@vercel/analytics/nuxt'

const { locale } = useI18n()
</script>

<template>
    <UApp :locale="locales[locale]">
        <NuxtRouteAnnouncer />
        <NuxtLoadingIndicator />
        <NuxtLayout>
            <Analytics />
            <NuxtPage />
        </NuxtLayout>
    </UApp>
</template>
