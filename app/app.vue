<script setup lang="ts">
import { Analytics } from '@vercel/analytics/nuxt';

const env = ref<string | undefined>(undefined);
try {
    env.value = process?.env?.NODE_ENV;
} catch {
    env.value = undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handleError = (error: any) => {
    console.error('Layout error:', error);
};
</script>

<template>
    <Html>
        <Body
            class="bg-zinc-50 dark:bg-zinc-900 text-black dark:text-white font-[Murecho] transition duration-50 delay-0 ease-in-out"
        >
            <NuxtRouteAnnouncer />
            <NuxtLayout>
                <Analytics />
                <NuxtErrorBoundary @error="handleError">
                    <NuxtPage />
                </NuxtErrorBoundary>
            </NuxtLayout>
            <UiToaster />
            <UiIsMaintenance
                v-if="env === 'development'"
                class="empty:hidden fixed bottom-0 right-0 m-2 opacity-40"
            />
        </Body>
    </Html>
</template>
