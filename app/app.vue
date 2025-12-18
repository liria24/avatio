<script setup lang="ts">
import { Analytics } from '@vercel/analytics/nuxt'
import * as locales from '@nuxt/ui/locale'

const { locale } = useI18n()
</script>

<template>
    <UApp :locale="locales[locale]">
        <Analytics />
        <NuxtRouteAnnouncer />
        <NuxtLoadingIndicator />
        <NuxtLayout>
            <NuxtPage />
        </NuxtLayout>
    </UApp>
</template>
