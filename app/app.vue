<script setup lang="ts">
import { Analytics } from '@vercel/analytics/nuxt'
import * as locales from '@nuxt/ui/locale'

const { locale } = useI18n()
const { getSession, getSessions } = useAuth()

await Promise.all([getSession(), getSessions()])
</script>

<template>
    <UApp :locale="locales[locale]">
        <Analytics />
        <NuxtRouteAnnouncer />
        <NuxtLoadingIndicator />
        <NuxtLayout>
            <div
                class="sentence bg-muted text-error ring-error hidden w-full items-center justify-center rounded-xl p-4 text-sm ring-2 noscript:flex"
            >
                {{ $t('jsWarning') }}
            </div>

            <NuxtPage />
        </NuxtLayout>
    </UApp>
</template>
