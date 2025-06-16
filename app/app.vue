<script setup lang="ts">
import { Analytics } from '@vercel/analytics/nuxt'

const isDev = import.meta.dev
</script>

<template>
    <UApp>
        <NuxtRouteAnnouncer />
        <NuxtLoadingIndicator />
        <NuxtLayout>
            <Analytics />
            <NuxtPage />
        </NuxtLayout>
        <UiToaster />
        <UiIsMaintenance
            v-if="isDev"
            class="fixed right-0 bottom-0 m-2 opacity-40 empty:hidden"
        />
    </UApp>
</template>
