<script setup lang="ts">
import { Analytics } from '@vercel/analytics/nuxt'
import type { NuxtError } from '#app'
import * as locales from '@nuxt/ui/locale'

const { locale } = useI18n()
const { getSession, getSessions } = useAuth()

const props = defineProps({
    error: {
        type: Object as PropType<NuxtError>,
        default: () => ({
            status: 500,
            statusText: 'Unknown Error',
        }),
    },
})

await Promise.all([getSession(), getSessions()])
</script>

<template>
    <UApp :locale="locales[locale]">
        <Analytics />
        <NuxtRouteAnnouncer />
        <NuxtLoadingIndicator />
        <NuxtLayout>
            <div class="mt-24 flex w-full flex-col items-center justify-center gap-4">
                <h1 class="font-mono text-9xl leading-none font-extralight text-nowrap">
                    {{ props.error.status }}
                </h1>
                <h2 class="text-muted text-lg">
                    {{ props.error.statusText }}
                </h2>
                <UButton
                    :to="$localePath('/')"
                    :label="$t('errors.backToHome')"
                    icon="mingcute:arrow-left-line"
                    variant="soft"
                    size="lg"
                    class="mt-4"
                />
            </div>
        </NuxtLayout>
    </UApp>
</template>
