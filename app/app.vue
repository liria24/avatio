<script setup lang="ts">
import * as locales from '@nuxt/ui/locale'
import { Analytics } from '@vercel/analytics/nuxt'

const { locale, t } = useI18n()
const toast = useToast()
const { consented, giveConsent } = useCookiesConsent()

useHead({
    htmlAttrs: {
        lang: () => locale.value,
    },
})

onMounted(() => {
    if (import.meta.client && !consented.value)
        toast.add({
            id: 'cookies-consent',
            icon: 'mingcute:cookie-fill',
            title: t('cookie.title'),
            description: t('cookie.description'),
            progress: false,
            duration: 0,
            actions: [
                {
                    label: t('cookie.accept'),
                    variant: 'outline',
                    onClick: giveConsent,
                },
            ],
            close: {
                onClick: giveConsent,
            },
        })
})
</script>

<template>
    <UApp :locale="locales[locale]">
        <NuxtPwaManifest />
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
