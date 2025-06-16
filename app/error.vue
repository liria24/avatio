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
    <UApp>
        <Html>
            <Body>
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
                <UiIsMaintenance
                    v-if="isDev"
                    class="fixed right-0 bottom-0 m-2 opacity-40 empty:hidden"
                />
            </Body>
        </Html>
    </UApp>
</template>
