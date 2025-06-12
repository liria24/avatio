<script setup lang="ts">
import { Analytics } from '@vercel/analytics/nuxt'

const isDev = import.meta.dev
</script>

<template>
    <Html>
        <Body
            class="bg-zinc-50 text-black transition duration-50 ease-in-out dark:bg-zinc-900 dark:text-white"
        >
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
        </Body>
    </Html>
</template>
