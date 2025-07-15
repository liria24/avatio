<script setup lang="ts">
import type { NuxtError } from '#app'
import * as locales from '@nuxt/ui/locale'

const { locale } = useI18n()

const props = defineProps({
    error: {
        type: Object as PropType<NuxtError>,
        default: () => ({
            statusCode: 500,
            statusMessage: 'Unknown Error',
        }),
    },
})
</script>

<template>
    <UApp :locale="locales[locale]">
        <NuxtRouteAnnouncer />
        <NuxtLoadingIndicator />
        <NuxtLayout>
            <div
                class="mt-24 flex w-full flex-col items-center justify-center gap-4"
            >
                <h1
                    class="font-[Geist] text-9xl leading-none font-extralight text-nowrap"
                >
                    {{ props.error.statusCode }}
                </h1>
                <h2 class="text-muted text-lg">
                    {{ props.error.message }}
                </h2>
                <UButton
                    :to="$localePath('/')"
                    label="ホームに戻る"
                    icon="lucide:arrow-left"
                    variant="soft"
                    size="lg"
                    class="mt-4"
                />
            </div>
        </NuxtLayout>
    </UApp>
</template>
