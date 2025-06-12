<script setup lang="ts">
import type { NuxtError } from 'nuxt/app'

const isDev = import.meta.dev

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
    <Html>
        <Body
            class="bg-zinc-50 text-black transition duration-50 ease-in-out dark:bg-zinc-900 dark:text-white"
        >
            <NuxtRouteAnnouncer />
            <NuxtLoadingIndicator />
            <NuxtLayout>
                <div class="flex flex-col items-center gap-4">
                    <h1
                        class="flex font-['Montserrat'] text-9xl font-extrabold text-zinc-500 dark:text-zinc-400"
                    >
                        {{ props.error.statusCode }}
                    </h1>
                    <p
                        class="text-xl font-bold text-zinc-500 dark:text-zinc-400"
                    >
                        {{ props.error.message }}
                    </p>
                    <Button
                        to="/"
                        label="ホーム"
                        icon="lucide:arrow-left"
                        variant="flat"
                    />
                </div>
            </NuxtLayout>
            <UiToaster />
            <UiIsMaintenance
                v-if="isDev"
                class="fixed right-0 bottom-0 m-2 opacity-40 empty:hidden"
            />
        </Body>
    </Html>
</template>
